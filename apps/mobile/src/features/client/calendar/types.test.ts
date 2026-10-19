import { describe, expect, it } from 'vitest';
import { toIcs } from './types';

describe('toIcs', () => {
  it('produit un VEVENT valide avec rappel 1 h avant et échappement', () => {
    const ics = toIcs({
      title: 'DEPANO · Fuite, évier',
      start: new Date('2026-10-20T08:00:00.000Z'),
      end: new Date('2026-10-20T09:00:00.000Z'),
      location: '12 rue Paradis, 13001 Marseille',
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20261020T080000Z');
    expect(ics).toContain('DTEND:20261020T090000Z');
    expect(ics).toContain('SUMMARY:DEPANO · Fuite\\, évier');
    expect(ics).toContain('LOCATION:12 rue Paradis\\, 13001 Marseille');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
