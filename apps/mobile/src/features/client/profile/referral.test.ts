import { describe, expect, it } from 'vitest';
import { creditStatus, creditTitle, euros, normalizeReferralCode, referralPitch, referralShareMessage, rewardRangeLabel } from './referral';

const nbsp = (s: string) => s.replace(/[  ]/g, ' ');

describe('parrainage', () => {
  it('annonce la fourchette (règles par défaut ou API)', () => {
    expect(nbsp(rewardRangeLabel(null))).toBe('entre 5 € et 20 €');
    expect(nbsp(rewardRangeLabel({ minCents: 1000, maxCents: 1500 }))).toBe('entre 10 € et 15 €');
    expect(nbsp(referralPitch())).toBe('Offrez entre 5 € et 20 € de réduction à un ami sur sa prochaine intervention — vous recevez le même montant.');
  });
  it('formate les montants', () => {
    expect(nbsp(euros(1200))).toBe('12 €');
    expect(nbsp(euros(1250))).toBe('12,50 €');
  });
  it('message de partage avec le code', () => {
    expect(referralShareMessage('LEA42')).toContain('LEA42');
    expect(referralShareMessage('LEA42')).toContain('https://depano.fr/parrainage/LEA42');
  });
  it('historique', () => {
    expect(creditTitle({ role: 'referrer', fromName: 'Léa' })).toBe('Léa a utilisé votre code');
    expect(creditTitle({ role: 'referee', fromName: 'Karim' })).toBe('Code de Karim');
    expect(creditStatus({ usedAt: null })).toBe('Disponible');
    expect(creditStatus({ usedAt: '2026-10-01T00:00:00Z' })).toBe('Utilisé');
  });
  it('normalise la saisie', () => {
    expect(normalizeReferralCode(' lea 42 ')).toBe('LEA42');
  });
});
