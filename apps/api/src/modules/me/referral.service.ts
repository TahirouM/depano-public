import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { RULES, formatEuros, randomReferralRewardCents, type ApplyReferralResult, type ReferralDto } from '@depano/schemas';
import { and, asc, clientProfiles, desc, eq, isNull, referralCredits, users, type DbOrTx, type Tx } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { RateLimiter } from '../../infra/redis';
import { NotificationsService } from '../notifications/notifications.service';
import { badRequest, conflict, notFound } from '../../common/errors';

/** Sans caractères ambigus (0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newReferralCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join('');

/** Le crédit d'une intervention annulée, expirée ou refusée redevient disponible. */
export async function releaseReferralCredit(db: DbOrTx, bookingId: string) {
  await db.update(referralCredits).set({ usedBookingId: null, usedAt: null, updatedAt: new Date() }).where(eq(referralCredits.usedBookingId, bookingId));
}

/**
 * Parrainage : le filleul saisit le code d'un ami (une seule fois par compte) ; un montant tiré au sort est crédité
 * aux deux. Chaque crédit est consommé par la prochaine intervention réservée et rendu si elle n'a pas lieu.
 */
@Injectable()
export class ReferralService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** Profil client et code de parrainage, créés à la volée (comptes antérieurs, artisans). */
  async ensureCode(userId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const [p] = await this.conn.db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId));
      if (p?.referralCode) return p;
      try {
        if (p) await this.conn.db.update(clientProfiles).set({ referralCode: newReferralCode() }).where(and(eq(clientProfiles.id, p.id), isNull(clientProfiles.referralCode)));
        else await this.conn.db.insert(clientProfiles).values({ userId, referralCode: newReferralCode() }).onConflictDoNothing({ target: clientProfiles.userId });
      } catch (e) {
        // Collision de code (unique) : on retente avec un autre.
        if (((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code) !== '23505') throw e;
      }
    }
    throw new Error('Impossible de générer un code de parrainage unique');
  }

  async get(userId: string): Promise<ReferralDto> {
    const profile = await this.ensureCode(userId);
    const rows = await this.conn.db
      .select({ c: referralCredits, first: users.firstName })
      .from(referralCredits)
      .leftJoin(users, eq(users.id, referralCredits.otherUserId))
      .where(eq(referralCredits.userId, userId))
      .orderBy(desc(referralCredits.createdAt));
    const available = rows.filter((r) => !r.c.usedAt).sort((a, b) => a.c.createdAt.getTime() - b.c.createdAt.getTime());
    return {
      code: profile.referralCode!,
      nextDiscountCents: available[0]?.c.amountCents ?? 0,
      availableCents: available.reduce((s, r) => s + r.c.amountCents, 0),
      referredCount: rows.filter((r) => r.c.role === 'referrer').length,
      canApplyCode: !profile.referredByUserId && !rows.some((r) => r.c.role === 'referee'),
      credits: rows.map(({ c, first }) => ({
        id: c.id,
        amountCents: c.amountCents,
        fromName: first ?? (c.role === 'referrer' ? 'Votre filleul' : 'Votre parrain'),
        role: c.role,
        usedAt: c.usedAt?.toISOString() ?? null,
        usedBookingId: c.usedBookingId,
        createdAt: c.createdAt.toISOString(),
      })),
      rewardRange: { minCents: RULES.referral.minRewardCents, maxCents: RULES.referral.maxRewardCents },
    };
  }

  /** Saisie du code d'un ami : une fois par compte, jamais son propre code ; même montant pour les deux. */
  async apply(userId: string, code: string): Promise<ApplyReferralResult> {
    await this.limiter.hit(`referral:${userId}`, 10, 3600, 'Trop de tentatives, réessayez plus tard.');
    const mine = await this.ensureCode(userId);
    const [owner] = await this.conn.db.select().from(clientProfiles).where(eq(clientProfiles.referralCode, code));
    if (!owner) throw notFound('referral_code_not_found', 'Ce code de parrainage est inconnu.');
    if (owner.userId === userId) throw badRequest('own_referral_code', 'Vous ne pouvez pas utiliser votre propre code.');
    const used = () => conflict('referral_already_applied', 'Vous avez déjà utilisé un code de parrainage.');
    if (mine.referredByUserId) throw used();
    const amountCents = randomReferralRewardCents();
    try {
      await this.conn.db.transaction(async (tx) => {
        const [p] = await tx
          .update(clientProfiles)
          .set({ referredByUserId: owner.userId, updatedAt: new Date() })
          .where(and(eq(clientProfiles.userId, userId), isNull(clientProfiles.referredByUserId)))
          .returning({ id: clientProfiles.id });
        if (!p) throw used();
        // L'index unique (filleul) protège aussi des saisies concurrentes.
        await tx.insert(referralCredits).values([
          { userId, otherUserId: owner.userId, role: 'referee', amountCents },
          { userId: owner.userId, otherUserId: userId, role: 'referrer', amountCents },
        ]);
      });
    } catch (e) {
      if (((e as { cause?: { code?: string } }).cause?.code ?? (e as { code?: string }).code) === '23505') throw used();
      throw e;
    }
    const [me] = await this.conn.db.select({ first: users.firstName }).from(users).where(eq(users.id, userId));
    await this.notifications.notify(owner.userId, {
      type: 'referral_reward',
      title: 'Parrainage réussi !',
      body: `${me?.first ?? 'Votre ami'} a utilisé votre code : ${formatEuros(amountCents)} de réduction sur votre prochaine intervention.`,
      data: { amountCents },
    });
    return { amountCents, referral: await this.get(userId) };
  }

  /**
   * Création d'une intervention : consomme le plus ancien crédit disponible (dans la transaction de création).
   * Renvoie la réduction appliquée, plafonnée au montant brut.
   */
  async consume(tx: Tx, clientId: string, bookingId: string, grossCents: number) {
    if (grossCents <= 0) return 0;
    const [credit] = await tx
      .select()
      .from(referralCredits)
      .where(and(eq(referralCredits.userId, clientId), isNull(referralCredits.usedAt)))
      .orderBy(asc(referralCredits.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });
    if (!credit) return 0;
    await tx.update(referralCredits).set({ usedBookingId: bookingId, usedAt: new Date(), updatedAt: new Date() }).where(eq(referralCredits.id, credit.id));
    return Math.min(credit.amountCents, grossCents);
  }

  /** Montant du crédit rattaché à l'intervention (pour recalculer la réduction quand le prix change). */
  async creditFor(bookingId: string) {
    const [c] = await this.conn.db.select({ amount: referralCredits.amountCents }).from(referralCredits).where(eq(referralCredits.usedBookingId, bookingId));
    return c?.amount ?? 0;
  }

  release(bookingId: string) {
    return releaseReferralCredit(this.conn.db, bookingId);
  }
}
