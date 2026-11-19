import { describe, expect, it } from 'vitest';
import { shiftDates } from './time';

describe('shiftDates', () => {
  const recordedAt = '2026-10-24T15:00:00.000Z';

  it('décale dates et horodatages du nombre de jours écoulés, heure conservée', () => {
    const out = shiftDates(
      { scheduledAt: '2026-10-25T07:00:00.000Z', day: { date: '2026-10-25', slots: ['2026-10-25T08:30:00+02:00'] }, label: 'Lundi' },
      recordedAt,
      new Date('2026-11-03T10:00:00.000Z'),
    );
    expect(out).toEqual({ scheduledAt: '2026-11-04T07:00:00.000Z', day: { date: '2026-11-04', slots: ['2026-11-04T06:30:00.000Z'] }, label: 'Lundi' });
  });

  it('ne touche à rien le jour de l’enregistrement', () => {
    const data = { at: '2026-10-24T08:00:00.000Z' };
    expect(shiftDates(data, recordedAt, new Date('2026-10-24T20:00:00.000Z'))).toEqual(data);
  });
});
