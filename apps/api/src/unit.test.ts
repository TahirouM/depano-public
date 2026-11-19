import { describe, expect, it } from 'vitest';
import { computeSlotDays } from './modules/catalog/slots.service';
import { parisToUtc, parisParts, addDays } from './common/time';
import { decrypt, encrypt, hmac } from './common/crypto';
import { toApiError } from './common/error.filter';
import { AppError } from './common/errors';
import { domainsForApe, normalizeApe } from './modules/artisan/artisan.service';
import { clientCancellationTerms, closingAmount } from './modules/bookings/booking-rules';
import { NotFoundException } from '@nestjs/common';
import { rateLimitFactor } from './infra/redis';

describe('fuseau Europe/Paris', () => {
  it('convertit les heures locales (été / hiver)', () => {
    expect(parisToUtc('2026-07-01', '08:00').toISOString()).toBe('2026-07-01T06:00:00.000Z');
    expect(parisToUtc('2026-12-01', '08:00').toISOString()).toBe('2026-12-01T07:00:00.000Z');
    // Jour du passage à l'heure d'hiver (25 octobre 2026)
    expect(parisToUtc('2026-10-25', '10:00').toISOString()).toBe('2026-10-25T09:00:00.000Z');
    expect(parisParts(new Date('2026-03-29T12:00:00Z')).time).toBe('14:00');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('génère des créneaux de 30 min en retirant indisponibilités et passé', () => {
    const now = new Date('2026-07-01T05:00:00Z'); // 07:00 à Paris
    const rules = [{ weekday: 3, startTime: '08:00', endTime: '11:00' }]; // mercredi
    const busy = [{ start: Date.parse('2026-07-01T07:00:00Z'), end: Date.parse('2026-07-01T08:00:00Z') }]; // 09:00-10:00
    const [day] = computeSlotDays({ rules, busy }, '2026-07-01', 1, 60, now);
    // 08:00 (min. 1 h de préavis atteint) ; 08:30, 09:00, 09:30 chevauchent ; 10:00 OK
    expect(day!.slots).toEqual(['2026-07-01T06:00:00.000Z', '2026-07-01T08:00:00.000Z']);
  });
});

describe('crypto', () => {
  it('chiffre / déchiffre (AES-256-GCM) et rejette une altération', () => {
    const enc = encrypt('secret', '4821');
    expect(decrypt('secret', enc)).toBe('4821');
    expect(decrypt('autre', enc)).toBeNull();
    expect(hmac('k', 'a')).toHaveLength(64);
  });
});

describe('erreurs', () => {
  it('produit un ApiErrorBody en français', () => {
    expect(toApiError(new AppError(409, 'x', 'Message'))).toEqual({ statusCode: 409, code: 'x', message: 'Message' });
    expect(toApiError(new NotFoundException())).toMatchObject({ statusCode: 404, code: 'not_found', message: 'Ressource introuvable.' });
    expect(toApiError({ cause: { code: '23P01' } })).toMatchObject({ statusCode: 409, code: 'slot_unavailable' });
    expect(toApiError(new Error('boom'))).toMatchObject({ statusCode: 500, code: 'internal_error' });
  });
});

describe('règles', () => {
  it('APE → métiers', () => {
    expect(domainsForApe('43.22A')).toEqual(['plomberie', 'energetique']);
    expect(domainsForApe('43.22B')).toEqual(['plomberie', 'energetique']);
    expect(domainsForApe('43.21A')).toEqual(['electricite']);
    expect(domainsForApe('62.01Z')).toEqual([]);
    // Formats réels : SIRENE, sans point, répertoire des métiers, NAF 2025, minuscules / espaces, null
    expect(domainsForApe('4322A')).toEqual(['plomberie', 'energetique']);
    expect(domainsForApe('4322AZ')).toEqual(['plomberie', 'energetique']);
    expect(domainsForApe('43.22G')).toEqual(['plomberie', 'energetique']);
    expect(domainsForApe(' 43.22 b ')).toEqual(['plomberie', 'energetique']);
    expect(domainsForApe('43.21.B')).toEqual(['electricite']);
    expect(domainsForApe(null, undefined, '')).toEqual([]);
    // Fusion de plusieurs codes (établissement + unité légale), ordre stable, sans doublon
    expect(domainsForApe('43.21A', '43.22A', '4322AZ')).toEqual(['plomberie', 'electricite', 'energetique']);
    expect(normalizeApe('4322AZ')).toBe('43.22A');
    expect(normalizeApe('43.22A')).toBe('43.22A');
    expect(normalizeApe('abc')).toBeNull();
  });

  const base = {
    status: 'accepted',
    kind: 'scheduled',
    withGuarantee: false,
    travelFeeCents: 2500,
    createdAt: new Date(),
    acceptedAt: new Date(),
    etaAt: null,
    totalCents: 14500,
    authorizedCents: 14500,
    travelOnly: false,
    discountCents: 0,
  } as any;

  it('annulation : retard artisan > 30 min ⇒ gratuite', () => {
    const now = new Date();
    const scheduledAt = new Date(now.getTime() - 45 * 60_000);
    expect(clientCancellationTerms({ ...base, scheduledAt }, now)).toEqual({ free: true, feeCents: 0 });
    const bookedLongAgo = { ...base, createdAt: new Date(now.getTime() - 3 * 3600_000) };
    expect(clientCancellationTerms({ ...bookedLongAgo, scheduledAt: new Date(now.getTime() - 45 * 60_000) }, now)).toEqual({ free: true, feeCents: 0 });
    expect(clientCancellationTerms({ ...bookedLongAgo, scheduledAt: new Date(now.getTime() + 3600_000) }, now)).toEqual({ free: false, feeCents: 2500 });
  });

  it('annulation : gratuite pendant 1 h après la prise de RDV, quelle que soit la date du RDV', () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60_000);
    const far = new Date(now.getTime() + 10 * 86_400_000);
    const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000);
    expect(clientCancellationTerms({ ...base, createdAt: at(10), scheduledAt: soon }, now).free).toBe(true);
    expect(clientCancellationTerms({ ...base, createdAt: at(59), scheduledAt: far }, now).free).toBe(true);
    // Au-delà d'1 h : frais de déplacement, même pour un RDV dans 10 jours…
    expect(clientCancellationTerms({ ...base, createdAt: at(61), scheduledAt: far }, now)).toEqual({ free: false, feeCents: 2500 });
    // … sauf garantie annulation, ou demande pas encore confirmée par l'artisan.
    expect(clientCancellationTerms({ ...base, createdAt: at(61), scheduledAt: far, withGuarantee: true }, now).free).toBe(true);
    expect(clientCancellationTerms({ ...base, status: 'requested', createdAt: at(600), scheduledAt: far }, now).free).toBe(true);
    expect(clientCancellationTerms({ ...base, status: 'pending_payment', createdAt: at(600), scheduledAt: far }, now).free).toBe(true);
  });

  it('montant de clôture', () => {
    expect(closingAmount(base, 16000)).toBe(14500);
    expect(closingAmount({ ...base, authorizedCents: 20000 }, 16000)).toBe(16000);
    expect(closingAmount({ ...base, travelOnly: true }, null)).toBe(2500);
    // Réduction parrainage : déduite du devis, jamais du déplacement seul.
    expect(closingAmount({ ...base, discountCents: 1000, authorizedCents: 20000 }, 16000)).toBe(15000);
    expect(closingAmount({ ...base, discountCents: 1000, travelOnly: true }, null)).toBe(2500);
  });
});

describe('limitation de débit', () => {
  it('garde les valeurs de production, multiplie ou désactive hors production', () => {
    expect(rateLimitFactor({ NODE_ENV: 'production', RATE_LIMIT_DISABLED: true, RATE_LIMIT_MULTIPLIER: 50 })).toBe(1);
    expect(rateLimitFactor({ NODE_ENV: 'development', RATE_LIMIT_DISABLED: false, RATE_LIMIT_MULTIPLIER: undefined })).toBe(20);
    expect(rateLimitFactor({ NODE_ENV: 'development', RATE_LIMIT_DISABLED: false, RATE_LIMIT_MULTIPLIER: 5 })).toBe(5);
    expect(rateLimitFactor({ NODE_ENV: 'development', RATE_LIMIT_DISABLED: true, RATE_LIMIT_MULTIPLIER: undefined })).toBe(Infinity);
    expect(rateLimitFactor({ NODE_ENV: 'test', RATE_LIMIT_DISABLED: false, RATE_LIMIT_MULTIPLIER: undefined })).toBe(1);
  });
});
