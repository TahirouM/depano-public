import { Inject, Injectable, Logger } from '@nestjs/common';
import { RULES, type PaymentSessionDto } from '@depano/schemas';
import { and, artisanProfiles, bookings, desc, eq, inArray, payments, sql, users, webhookEvents } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { PAYMENT_PROVIDER } from '../../infra/tokens';
import type { PaymentProvider } from '../../providers/payment.provider';
import type { BookingRow } from '../bookings/booking-state.service';
import { badRequest } from '../../common/errors';
import { days } from '../../common/time';

type PaymentRow = typeof payments.$inferSelect;
const CAPTURABLE_KINDS = ['authorization', 'supplement'];

/** Orchestration des paiements d'une intervention (empreinte, capture, annulation, webhooks). */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(PAYMENT_PROVIDER) readonly provider: PaymentProvider,
  ) {}

  async ensureCustomer(userId: string) {
    const [u] = await this.conn.db.select().from(users).where(eq(users.id, userId));
    if (!u) throw badRequest('user_not_found', 'Utilisateur introuvable.');
    const id = await this.provider.ensureCustomer({
      id: u.id,
      email: u.email,
      phone: u.phone,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
      customerId: u.stripeCustomerId,
    });
    if (id !== u.stripeCustomerId) await this.conn.db.update(users).set({ stripeCustomerId: id }).where(eq(users.id, userId));
    return id;
  }

  private async destinationFor(artisanId: string | null) {
    if (!artisanId) return null;
    const [a] = await this.conn.db.select({ acct: artisanProfiles.stripeAccountId }).from(artisanProfiles).where(eq(artisanProfiles.id, artisanId));
    return a?.acct ?? null;
  }

  /** Autorisation immédiate (urgence, RDV ≤ 6 jours) ou SetupIntent + autorisation 24 h avant. */
  needsDeferredAuthorization(b: Pick<BookingRow, 'kind' | 'scheduledAt'>, now = new Date()) {
    return b.kind === 'scheduled' && !!b.scheduledAt && b.scheduledAt.getTime() - now.getTime() > days(RULES.authorizationMaxDaysAhead);
  }

  async createSession(b: BookingRow, paymentMethodId?: string | null): Promise<PaymentSessionDto> {
    const customerId = await this.ensureCustomer(b.clientId);
    const ephemeralKey = await this.provider.createEphemeralKey(customerId).catch(() => null);
    if (this.needsDeferredAuthorization(b)) {
      const si = await this.provider.createSetupIntent({ customerId, bookingId: b.id });
      await this.conn.db.insert(payments).values({ bookingId: b.id, provider: this.provider.name, providerRef: si.id, kind: 'setup', status: 'requires_action', amountCents: b.totalCents });
      return { provider: this.provider.name, paymentIntentId: null, setupIntentId: si.id, clientSecret: si.clientSecret, customerId, ephemeralKey, amountCents: b.totalCents };
    }
    const pi = await this.provider.createAuthorization({
      bookingId: b.id,
      kind: 'authorization',
      amountCents: b.totalCents,
      customerId,
      destinationAccountId: await this.destinationFor(b.artisanId),
      paymentMethodId,
      description: `DEPANO ${b.reference}`,
    });
    await this.conn.db.insert(payments).values({ bookingId: b.id, provider: this.provider.name, providerRef: pi.id, kind: 'authorization', status: 'requires_action', amountCents: b.totalCents });
    return { provider: this.provider.name, paymentIntentId: pi.id, setupIntentId: null, clientSecret: pi.clientSecret, customerId, ephemeralKey, amountCents: b.totalCents };
  }

  /** Autorisation complémentaire (devis > autorisé + 20 %). */
  async createSupplement(b: BookingRow, amountCents: number, opts: { offSession?: boolean } = {}): Promise<PaymentSessionDto> {
    const customerId = await this.ensureCustomer(b.clientId);
    let paymentMethodId: string | null = null;
    if (opts.offSession) {
      const [main] = await this.capturable(b.id);
      paymentMethodId = main?.paymentMethodRef ?? null;
    }
    const pi = await this.provider.createAuthorization({
      bookingId: b.id,
      kind: 'supplement',
      amountCents,
      customerId,
      paymentMethodId,
      offSession: opts.offSession && !!paymentMethodId,
      destinationAccountId: await this.destinationFor(b.artisanId),
      description: `DEPANO ${b.reference} (complément devis)`,
    });
    await this.conn.db.insert(payments).values({ bookingId: b.id, provider: this.provider.name, providerRef: pi.id, kind: 'supplement', status: 'requires_action', amountCents });
    if (pi.status === 'authorized') await this.markAuthorized(pi.id);
    return {
      provider: this.provider.name,
      paymentIntentId: pi.id,
      setupIntentId: null,
      clientSecret: pi.clientSecret,
      customerId,
      ephemeralKey: await this.provider.createEphemeralKey(customerId).catch(() => null),
      amountCents,
    };
  }

  /** Passe un paiement en « autorisé » et met à jour le montant autorisé de l'intervention. Idempotent. */
  async markAuthorized(providerRef: string, paymentMethodRef?: string | null) {
    return this.conn.db.transaction(async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.providerRef, providerRef)).for('update');
      if (!p || p.status !== 'requires_action') return p ?? null;
      const [updated] = await tx
        .update(payments)
        .set({ status: 'authorized', authorizedAt: new Date(), paymentMethodRef: paymentMethodRef ?? p.paymentMethodRef })
        .where(eq(payments.id, p.id))
        .returning();
      if (CAPTURABLE_KINDS.includes(p.kind)) {
        await tx.update(bookings).set({ authorizedCents: sql`${bookings.authorizedCents} + ${p.amountCents}` }).where(eq(bookings.id, p.bookingId));
      }
      return updated!;
    });
  }

  /** Interroge le prestataire pour le dernier paiement en attente de l'intervention. */
  async syncPending(bookingId: string): Promise<{ ok: boolean; setup: boolean }> {
    const [p] = await this.conn.db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), inArray(payments.kind, ['authorization', 'setup'])))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (!p?.providerRef) return { ok: false, setup: false };
    if (p.status === 'authorized') return { ok: true, setup: p.kind === 'setup' };
    const intent = await this.provider.getIntent(p.providerRef);
    if (intent.status === 'authorized' || intent.status === 'setup_succeeded') {
      await this.markAuthorized(p.providerRef, intent.paymentMethodId);
      return { ok: true, setup: p.kind === 'setup' };
    }
    if (intent.status === 'failed' || intent.status === 'cancelled') {
      await this.conn.db.update(payments).set({ status: intent.status === 'failed' ? 'failed' : 'cancelled' }).where(eq(payments.id, p.id));
    }
    return { ok: false, setup: p.kind === 'setup' };
  }

  /** Autorisation hors session 24 h avant un RDV lointain (job authorize-scheduled). */
  async authorizeScheduled(b: BookingRow) {
    const [setup] = await this.conn.db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, b.id), eq(payments.kind, 'setup'), eq(payments.status, 'authorized')))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    const already = await this.capturable(b.id);
    if (already.length) return { authorized: true };
    if (!setup?.paymentMethodRef) return { authorized: false, reason: 'no_payment_method' };
    const customerId = await this.ensureCustomer(b.clientId);
    try {
      const pi = await this.provider.createAuthorization({
        bookingId: b.id,
        kind: 'authorization',
        amountCents: b.totalCents,
        customerId,
        destinationAccountId: await this.destinationFor(b.artisanId),
        paymentMethodId: setup.paymentMethodRef,
        offSession: true,
        description: `DEPANO ${b.reference}`,
      });
      await this.conn.db.insert(payments).values({ bookingId: b.id, provider: this.provider.name, providerRef: pi.id, kind: 'authorization', status: 'requires_action', amountCents: b.totalCents, paymentMethodRef: setup.paymentMethodRef });
      if (pi.status === 'authorized') await this.markAuthorized(pi.id);
      return { authorized: pi.status === 'authorized' };
    } catch (e) {
      this.logger.warn(`autorisation différée refusée ${b.id} : ${e}`);
      await this.conn.db.insert(payments).values({ bookingId: b.id, provider: this.provider.name, providerRef: null, kind: 'authorization', status: 'failed', amountCents: b.totalCents, failureReason: String(e) });
      return { authorized: false, reason: 'declined' };
    }
  }

  async capturable(bookingId: string): Promise<PaymentRow[]> {
    return this.conn.db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), inArray(payments.kind, CAPTURABLE_KINDS), eq(payments.status, 'authorized')))
      .orderBy(payments.createdAt);
  }

  async listForBooking(bookingId: string) {
    return this.conn.db.select().from(payments).where(eq(payments.bookingId, bookingId)).orderBy(payments.createdAt);
  }

  /**
   * Capture `amountCents` sur les autorisations (principale puis complémentaires), commission
   * prélevée sur la première capture ; le reliquat non capturé est libéré.
   */
  async capture(b: BookingRow, amountCents: number, applicationFeeCents: number): Promise<number> {
    const rows = await this.capturable(b.id);
    const destination = await this.destinationFor(b.artisanId);
    let remaining = Math.max(0, amountCents);
    let fee = Math.max(0, applicationFeeCents);
    let captured = 0;
    for (const p of rows) {
      const part = Math.min(remaining, p.amountCents);
      if (part <= 0) {
        await this.provider.cancel(p.providerRef!);
        await this.conn.db.update(payments).set({ status: 'cancelled' }).where(eq(payments.id, p.id));
        continue;
      }
      const partFee = Math.min(fee, part);
      await this.provider.capture(p.providerRef!, { amountCents: part, applicationFeeCents: partFee, destinationAccountId: destination, bookingId: b.id });
      await this.conn.db
        .update(payments)
        .set({ status: part < p.amountCents ? 'partially_captured' : 'captured', capturedCents: part, applicationFeeCents: partFee, capturedAt: new Date() })
        .where(eq(payments.id, p.id));
      remaining -= part;
      fee -= partFee;
      captured += part;
    }
    return captured;
  }

  /** Libère toutes les empreintes (annulation gratuite, expiration, remboursement total). */
  async releaseAll(bookingId: string) {
    const rows = await this.conn.db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, bookingId), inArray(payments.status, ['authorized', 'requires_action'])));
    for (const p of rows) {
      if (p.providerRef && p.kind !== 'setup') await this.provider.cancel(p.providerRef).catch((e) => this.logger.warn(`annulation ${p.providerRef} : ${e}`));
      await this.conn.db.update(payments).set({ status: 'cancelled' }).where(eq(payments.id, p.id));
    }
  }

  /* -------------------------- Webhooks Stripe -------------------------- */

  /** Enregistre l'événement (idempotence) ; renvoie false s'il a déjà été traité. */
  async recordWebhook(provider: string, id: string, type: string, payload: unknown) {
    const inserted = await this.conn.db
      .insert(webhookEvents)
      .values({ provider, eventId: id, type, payload: payload as object })
      .onConflictDoNothing({ target: webhookEvents.eventId })
      .returning({ id: webhookEvents.id });
    if (inserted.length) return true;
    const [e] = await this.conn.db.select({ processedAt: webhookEvents.processedAt }).from(webhookEvents).where(eq(webhookEvents.eventId, id));
    return !e?.processedAt;
  }

  async markWebhook(id: string, error?: string) {
    await this.conn.db
      .update(webhookEvents)
      .set(error ? { error } : { processedAt: new Date(), error: null })
      .where(eq(webhookEvents.eventId, id));
  }

  async markFailed(providerRef: string, reason: string | null) {
    await this.conn.db.update(payments).set({ status: 'failed', failureReason: reason }).where(and(eq(payments.providerRef, providerRef), eq(payments.status, 'requires_action')));
  }

  async bookingIdForRef(providerRef: string) {
    const [p] = await this.conn.db.select({ bookingId: payments.bookingId }).from(payments).where(eq(payments.providerRef, providerRef));
    return p?.bookingId ?? null;
  }
}
