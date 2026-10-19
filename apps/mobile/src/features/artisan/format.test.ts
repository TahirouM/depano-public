import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  centsToInput,
  earningsCsv,
  parseEuros,
  parseFrDate,
  rulesError,
} from './format';

describe('format artisan', () => {
  it('parseEuros accepte virgule, point et symbole', () => {
    expect(parseEuros('90')).toBe(9000);
    expect(parseEuros('48,90')).toBe(4890);
    expect(parseEuros('12.5 €')).toBe(1250);
    expect(parseEuros('')).toBeNull();
    expect(parseEuros('12,345')).toBeNull();
    expect(parseEuros('abc')).toBeNull();
  });
  it('centsToInput est l’inverse lisible', () => {
    expect(centsToInput(9000)).toBe('90');
    expect(centsToInput(4890)).toBe('48,90');
    expect(centsToInput(null)).toBe('');
  });
  it('parseFrDate refuse les dates impossibles', () => {
    expect(parseFrDate('31/12/2027')).toBe('2027-12-31');
    expect(parseFrDate('31/02/2027')).toBeNull();
    expect(parseFrDate('2027-12-31')).toBeNull();
  });
  it('rulesError détecte fin avant début et chevauchement', () => {
    expect(rulesError([{ weekday: 1, start: '08:00', end: '12:00' }])).toBeNull();
    expect(rulesError([{ weekday: 1, start: '12:00', end: '08:00' }])).toMatch(/Lundi/);
    expect(
      rulesError([
        { weekday: 2, start: '08:00', end: '12:00' },
        { weekday: 2, start: '11:00', end: '14:00' },
      ]),
    ).toMatch(/chevauchent/);
  });
  it('earningsCsv produit un CSV « ; » en euros', () => {
    const csv = earningsCsv({
      lines: [
        {
          bookingId: 'b',
          reference: 'DEP-1',
          date: '2026-10-19T13:00:00Z',
          grossCents: 19890,
          commissionCents: 2984,
          netCents: 16906,
        },
      ],
    });
    expect(csv.split('\n')[1]).toBe('2026-10-19;DEP-1;198,90;29,84;169,06');
  });
  it('addBusinessDays saute le week-end', () => {
    // vendredi 23 octobre 2026 + 2 jours ouvrés = mardi 27
    expect(addBusinessDays(new Date(2026, 9, 23, 10), 2).getDate()).toBe(27);
  });
});
