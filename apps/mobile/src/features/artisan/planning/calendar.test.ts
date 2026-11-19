import type { AvailabilityExceptionDto, BookingSummaryDto } from '@depano/schemas';
import type { Theme } from '@depano/ui';
import { describe, expect, it } from 'vitest';
import { dayDots, dayItems, monthWeeks, shortTime, timelineRows } from './calendar';
import { EVENT_COLOR_LABELS, EVENT_COLORS, eventColor } from './eventColors';

const booking = (p: Partial<BookingSummaryDto>): BookingSummaryDto => ({
  id: 'b1',
  reference: 'DEP-1',
  kind: 'scheduled',
  status: 'accepted',
  domain: 'plomberie',
  serviceName: null,
  problemReason: "Fuite d'eau",
  scheduledAt: null,
  createdAt: new Date(2026, 2, 1).toISOString(),
  totalCents: 9000,
  city: 'Marseille',
  counterpart: null,
  unreadMessages: 0,
  priceOnRequest: false,
  artisanAccepted: true,
  rescheduledFromId: null,
  artisanNote: null,
  endsAt: null,
  requestExpiresAt: null,
  ...p,
});

const exception = (p: Partial<AvailabilityExceptionDto>): AvailabilityExceptionDto => ({
  id: 'e1',
  startsAt: new Date(2026, 2, 18, 12).toISOString(),
  endsAt: new Date(2026, 2, 18, 13).toISOString(),
  reason: 'Manger avec Grégoire',
  kind: 'personal',
  color: 'green',
  ...p,
});

describe('calendrier du mois', () => {
  it('mars 2026 : commence un dimanche, 6 semaines, cases vides hors du mois', () => {
    const weeks = monthWeeks(new Date(2026, 2, 18));
    expect(weeks).toHaveLength(6);
    expect(weeks[0]!.slice(0, 6).every((d) => d === null)).toBe(true);
    expect(weeks[0]![6]!.getDate()).toBe(1);
    expect(weeks[5]![1]!.getDate()).toBe(31);
    expect(weeks[5]![2]).toBeNull();
  });
  it('février 2027 : 4 semaines pleines, pas de semaine vide en trop', () => {
    const weeks = monthWeeks(new Date(2027, 1, 1));
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().filter(Boolean)).toHaveLength(28);
  });
});

describe('journée du planning', () => {
  const day = new Date(2026, 2, 18);
  const planning = {
    bookings: [
      booking({
        id: 'b2',
        scheduledAt: new Date(2026, 2, 18, 10).toISOString(),
        domain: 'energetique',
      }),
      booking({ id: 'b1', scheduledAt: new Date(2026, 2, 18, 8).toISOString() }),
      booking({
        id: 'bx',
        scheduledAt: new Date(2026, 2, 18, 9).toISOString(),
        status: 'cancelled_by_client',
      }),
      booking({ id: 'b3', scheduledAt: new Date(2026, 2, 19, 8).toISOString() }),
      booking({
        id: 'b4',
        scheduledAt: new Date(2026, 2, 18, 15).toISOString(),
        status: 'requested',
      }),
    ],
    exceptions: [
      exception({}),
      exception({
        id: 'e2',
        kind: 'unavailable',
        color: null,
        startsAt: new Date(2026, 2, 17).toISOString(),
        endsAt: new Date(2026, 2, 20).toISOString(),
        reason: 'Congés',
      }),
    ],
  };

  it('trie, exclut les annulées et les autres jours, repère la journée entière', () => {
    const items = dayItems(planning, day);
    expect(items.map((i) => i.id)).toEqual(['e2', 'b1', 'b2', 'e1', 'b4']);
    const conges = items[0]!;
    expect(conges.type === 'unavailable' && conges.allDay).toBe(true);
    const repas = items.find((i) => i.id === 'e1')!;
    expect(repas.type === 'personal' && !repas.allDay).toBe(true);
    expect(items[1]!.end.getHours()).toBe(9);
  });

  it('pastilles : métier, couleur de l’événement, demande', () => {
    const dots = dayDots(dayItems(planning, day), 5);
    expect(dots[0]).toMatchObject({ type: 'unavailable' });
    expect(dots[1]).toMatchObject({ type: 'domain', domain: 'plomberie', requested: false });
    expect(dots[3]).toMatchObject({ type: 'event', color: 'green' });
    expect(dots[4]).toMatchObject({ type: 'domain', requested: true });
    expect(dayDots(dayItems(planning, day))).toHaveLength(3);
  });

  it('frise : lignes de 2 h de 8:00 à 20:00, éléments sous leur heure', () => {
    const rows = timelineRows(dayItems(planning, day), { day });
    expect(rows.map((r) => r.hour)).toEqual([8, 10, 12, 14, 16, 18, 20]);
    expect(rows[0]!.items.map((i) => i.id)).toEqual(['b1']);
    expect(rows[1]!.items.map((i) => i.id)).toEqual(['b2']);
    expect(rows[2]!.items.map((i) => i.id)).toEqual(['e1']);
    expect(rows[3]!.items.map((i) => i.id)).toEqual(['b4']);
    expect(rows.flatMap((r) => r.items).some((i) => i.id === 'e2')).toBe(false);
  });

  it('frise élargie pour un RDV tôt le matin ou tard le soir', () => {
    const items = dayItems(
      {
        bookings: [
          booking({ id: 'early', scheduledAt: new Date(2026, 2, 18, 7, 30).toISOString() }),
          booking({ id: 'late', scheduledAt: new Date(2026, 2, 18, 21).toISOString() }),
        ],
        exceptions: [],
      },
      day,
    );
    const rows = timelineRows(items, { day });
    expect(rows[0]!.hour).toBe(6);
    expect(rows[0]!.items[0]!.id).toBe('early');
    expect(rows[rows.length - 1]!.hour).toBe(20);
    expect(rows[rows.length - 1]!.items[0]!.id).toBe('late');
  });

  it('heure courte', () => {
    expect(shortTime(new Date(2026, 2, 18, 8, 0))).toBe('8:00');
    expect(shortTime(new Date(2026, 2, 18, 14, 5))).toBe('14:05');
  });
});

describe('couleurs des événements', () => {
  const tone = (solid: string) => ({ solid, onSolid: '#fff', soft: '#eee', text: solid });
  const t = {
    scheme: 'light',
    colors: {
      tone: {
        neutral: tone('neutral'),
        brand: tone('brand'),
        info: tone('info'),
        success: tone('success'),
        warning: tone('warning'),
        danger: tone('danger'),
        urgent: tone('urgent'),
      },
    },
  } as unknown as Pick<Theme, 'scheme' | 'colors'>;

  it('chaque couleur API a un libellé et une teinte du thème', () => {
    for (const c of EVENT_COLORS) {
      expect(EVENT_COLOR_LABELS[c]).toBeTruthy();
      expect(eventColor(c, t).solid).toBeTruthy();
    }
    expect(eventColor('green', t).solid).toBe('success');
    expect(eventColor('red', t).solid).toBe('danger');
    expect(eventColor(null, t).solid).toBe('info');
    expect(eventColor('purple', t).solid).toMatch(/^#/);
    expect(eventColor('purple', { ...t, scheme: 'dark' }).solid).not.toBe(
      eventColor('purple', t).solid,
    );
  });
});
