import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PaymentProvider, WebhookEvent } from './payment.provider';
import { badRequest } from '../common/errors';

const short = (v: string) => createHash('sha256').update(v).digest('hex').slice(0, 16);

/**
 * Paiement factice (PAYMENT_PROVIDER=fake) : tout réussit instantanément,
 * identifiants déterministes, aucun appel externe.
 */
@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'fake' as const;
  private readonly logger = new Logger('FakePayments');
  private seq = 0;
  /** États forcés (tests) : simule un client qui n'a pas encore validé, ou une carte refusée. */
  readonly intentOverrides = new Map<string, 'requires_action' | 'failed' | 'cancelled'>();

  async ensureCustomer(user: { id: string; customerId: string | null }) {
    return user.customerId ?? `cus_fake_${short(user.id)}`;
  }

  async createAuthorization(input: { bookingId: string; kind: string; amountCents: number; offSession?: boolean }) {
    // Déterministe à partir des entrées ; le compteur ne sert qu'à distinguer deux autorisations identiques.
    const id = `pi_fake_${short(`${input.bookingId}:${input.kind}:${input.amountCents}:${this.seq++}`)}`;
    this.logger.log(`autorisation ${id} ${input.amountCents} c (${input.kind})`);
    // Comme Stripe : un complément « en session » attend la validation du client (payment sheet) puis
    // POST /bookings/:id/confirm-payment ; l'empreinte initiale et les compléments hors session passent directement.
    const status = input.kind === 'supplement' && !input.offSession ? ('requires_action' as const) : ('authorized' as const);
    return { id, clientSecret: `${id}_secret_fake`, status };
  }

  async createSetupIntent(input: { customerId: string; bookingId?: string }) {
    const id = `seti_fake_${short(`${input.customerId}:${input.bookingId ?? ''}:${this.seq++}`)}`;
    return { id, clientSecret: `${id}_secret_fake`, status: 'setup_succeeded' as const };
  }

  async createEphemeralKey() {
    return null;
  }

  async getIntent(id: string) {
    const forced = this.intentOverrides.get(id);
    if (forced) return { status: forced, amountCapturableCents: 0, paymentMethodId: null };
    if (id.startsWith('seti_')) return { status: 'setup_succeeded' as const, amountCapturableCents: 0, paymentMethodId: 'pm_fake_visa' };
    return { status: 'authorized' as const, amountCapturableCents: Number.MAX_SAFE_INTEGER, paymentMethodId: 'pm_fake_visa' };
  }

  async capture(id: string, input: { amountCents: number; applicationFeeCents: number }) {
    this.logger.log(`capture ${id} ${input.amountCents} c (commission ${input.applicationFeeCents} c)`);
  }

  async cancel(id: string) {
    this.logger.log(`annulation ${id}`);
  }

  async refund(id: string, amountCents?: number) {
    this.logger.log(`remboursement ${id} ${amountCents ?? 'total'}`);
  }

  async listPaymentMethods() {
    return [{ id: 'pm_fake_visa', brand: 'visa', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 3, isDefault: true }];
  }

  async detachPaymentMethod() {}

  async createConnectedAccount(input: { artisanId: string }) {
    return `acct_fake_${short(input.artisanId)}`;
  }

  async createAccountLink(accountId: string, returnUrl: string) {
    return `${returnUrl}?fake_account=${accountId}`;
  }

  async getAccount() {
    return { payoutsEnabled: true };
  }

  async getBalance() {
    return null;
  }

  async listPayouts() {
    return [];
  }

  parseWebhook(rawBody: Buffer): WebhookEvent {
    try {
      const e = JSON.parse(rawBody.toString('utf8'));
      return { id: e.id, type: e.type, object: e.data?.object ?? {}, raw: e };
    } catch {
      throw badRequest('invalid_webhook', 'Webhook invalide.');
    }
  }
}
