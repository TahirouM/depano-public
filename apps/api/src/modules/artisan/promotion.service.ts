import { Inject, Injectable, Logger } from '@nestjs/common';
import { RULES, type PromotionDto, type PromotionSubscribeResult } from '@depano/schemas';
import { and, artisanProfiles, eq, lte, sql } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { PaymentsService } from '../payments/payments.service';
import { forbidden, notFound } from '../../common/errors';
import { days } from '../../common/time';

type ProfileRow = typeof artisanProfiles.$inferSelect;

export const promotionActive = (p: Pick<ProfileRow, 'proUntil'>, now = new Date()) => !!p.proUntil && p.proUntil > now;

/** Prolonge d'une période à partir de la fin actuelle (ou de maintenant si la promotion est échue). */
const extend = (p: Pick<ProfileRow, 'proUntil'>, now = new Date()) =>
  new Date(Math.max(now.getTime(), p.proUntil?.getTime() ?? 0) + days(RULES.promotion.periodDays));

/**
 * « Promouvoir mon compte » : abonnement de l'artisan, profil mis en avant dans la recherche tant que pro_until > now.
 * Prestataire factice : période payée immédiatement, renouvelée par le job de maintenance « promotion-renew ».
 * Stripe : abonnement Billing, période prolongée par le webhook `invoice.paid`.
 */
@Injectable()
export class PromotionService {
  private readonly logger = new Logger('Promotion');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
  ) {}

  private async row(artisanId: string) {
    const [p] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.id, artisanId));
    if (!p) throw notFound('artisan_not_found', 'Profil artisan introuvable.');
    return p;
  }

  toDto(p: ProfileRow): PromotionDto {
    return {
      active: promotionActive(p),
      until: p.proUntil?.toISOString() ?? null,
      autoRenew: p.promotionAutoRenew,
      priceCents: RULES.promotion.priceCents,
      periodDays: RULES.promotion.periodDays,
    };
  }

  async get(artisanId: string) {
    return this.toDto(await this.row(artisanId));
  }

  async subscribe(artisan: { id: string; userId: string }): Promise<PromotionSubscribeResult> {
    const p = await this.row(artisan.id);
    if (p.status !== 'approved') throw forbidden('artisan_not_approved', 'Votre profil doit être validé pour être mis en avant.');
    // Déjà abonné : simple reprise du renouvellement après une résiliation.
    if (p.promotionSubscriptionRef && (promotionActive(p) || p.promotionAutoRenew)) {
      if (!p.promotionAutoRenew) {
        await this.payments.provider.setPromotionAutoRenew(p.promotionSubscriptionRef, true);
        await this.conn.db.update(artisanProfiles).set({ promotionAutoRenew: true }).where(eq(artisanProfiles.id, p.id));
      }
      return { promotion: await this.get(p.id), payment: null };
    }
    const customerId = await this.payments.ensureCustomer(artisan.userId);
    const sub = await this.payments.provider.createPromotionSubscription({
      customerId,
      artisanId: p.id,
      priceCents: RULES.promotion.priceCents,
      periodDays: RULES.promotion.periodDays,
    });
    await this.conn.db
      .update(artisanProfiles)
      .set({
        promotionSubscriptionRef: sub.ref,
        promotionAutoRenew: true,
        ...(sub.status === 'active' ? { proUntil: sub.currentPeriodEnd ?? extend(p) } : {}),
      })
      .where(eq(artisanProfiles.id, p.id));
    const payment =
      sub.status === 'requires_action' && sub.clientSecret
        ? {
            provider: this.payments.provider.name,
            paymentIntentId: sub.paymentIntentId,
            setupIntentId: null,
            clientSecret: sub.clientSecret,
            customerId,
            ephemeralKey: await this.payments.provider.createEphemeralKey(customerId).catch(() => null),
            amountCents: RULES.promotion.priceCents,
          }
        : null;
    return { promotion: await this.get(p.id), payment };
  }

  /** Résiliation : la mise en avant reste active jusqu'à la fin de la période payée. */
  async cancel(artisan: { id: string }): Promise<PromotionDto> {
    const p = await this.row(artisan.id);
    if (p.promotionSubscriptionRef && p.promotionAutoRenew) await this.payments.provider.setPromotionAutoRenew(p.promotionSubscriptionRef, false);
    await this.conn.db.update(artisanProfiles).set({ promotionAutoRenew: false }).where(eq(artisanProfiles.id, p.id));
    return this.get(p.id);
  }

  /** Webhook Stripe `invoice.paid` d'un abonnement : période prolongée jusqu'à la fin facturée. */
  async onInvoicePaid(subscriptionRef: string, periodEnd: Date | null) {
    const [p] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.promotionSubscriptionRef, subscriptionRef));
    if (!p) return false;
    const until = periodEnd && periodEnd > (p.proUntil ?? new Date(0)) ? periodEnd : extend(p);
    await this.conn.db.update(artisanProfiles).set({ proUntil: until }).where(eq(artisanProfiles.id, p.id));
    return true;
  }

  /** Webhook Stripe `customer.subscription.deleted` : plus de renouvellement (la période payée reste acquise). */
  async onSubscriptionEnded(subscriptionRef: string) {
    await this.conn.db.update(artisanProfiles).set({ promotionAutoRenew: false, promotionSubscriptionRef: null }).where(eq(artisanProfiles.promotionSubscriptionRef, subscriptionRef));
  }

  /** Job maintenance « promotion-renew » : renouvelle les abonnements factices échus (Stripe renouvelle seul). */
  async renewExpired(now = new Date()) {
    if (this.payments.provider.name !== 'fake') return { renewed: 0 };
    const renewed = await this.conn.db
      .update(artisanProfiles)
      .set({ proUntil: sql`greatest(${artisanProfiles.proUntil}, ${now.toISOString()}::timestamptz) + make_interval(days => ${RULES.promotion.periodDays})` })
      .where(and(eq(artisanProfiles.promotionAutoRenew, true), lte(artisanProfiles.proUntil, now), sql`${artisanProfiles.promotionSubscriptionRef} like 'sub_fake_%'`))
      .returning({ id: artisanProfiles.id });
    if (renewed.length) this.logger.log(`promotion renouvelée : ${renewed.length} artisan(s)`);
    return { renewed: renewed.length };
  }
}
