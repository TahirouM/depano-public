import { RULES, formatEuros, type ReferralCreditDto, type ReferralDto } from '@depano/schemas';

/** Fourchette annoncée (« entre 5 € et 20 € »), depuis l'API ou les règles partagées. */
export function rewardRangeLabel(range: ReferralDto['rewardRange'] | null | undefined): string {
  const min = range?.minCents ?? RULES.referral.minRewardCents;
  const max = range?.maxCents ?? RULES.referral.maxRewardCents;
  return `entre ${euros(min)} et ${euros(max)}`;
}

/** Euros sans centimes quand le montant est rond (« 5 € », « 12,50 € »). */
export function euros(cents: number): string {
  return cents % 100 === 0 ? formatEuros(cents).replace(/,00/, '') : formatEuros(cents);
}

export function referralPitch(range?: ReferralDto['rewardRange'] | null): string {
  return `Offrez ${rewardRangeLabel(range)} de réduction à un ami sur sa prochaine intervention — vous recevez le même montant.`;
}

export function referralShareMessage(code: string, range?: ReferralDto['rewardRange'] | null): string {
  return `J'utilise DEPANO pour trouver des artisans vérifiés, avec un prix connu d'avance. Inscris-toi avec mon code ${code} : tu gagnes ${rewardRangeLabel(range)} sur ta première intervention. https://depano.fr/parrainage/${code}`;
}

/** Ligne d'historique : « Parrainage de Léa · 12 € · utilisé ». */
export function creditTitle(c: Pick<ReferralCreditDto, 'role' | 'fromName'>): string {
  return c.role === 'referrer' ? `${c.fromName} a utilisé votre code` : `Code de ${c.fromName}`;
}

export function creditStatus(c: Pick<ReferralCreditDto, 'usedAt'>): string {
  return c.usedAt ? 'Utilisé' : 'Disponible';
}

/** Saisie normalisée d'un code d'ami (espaces retirés, majuscules), comme `ApplyReferralBody`. */
export function normalizeReferralCode(v: string): string {
  return v.replace(/\s+/g, '').toUpperCase().slice(0, 16);
}
