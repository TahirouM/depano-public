import type { BookingDetailDto } from '@depano/schemas';
import { describe, expect, it } from 'vitest';
import { NOT_FEASIBLE_LABEL, buildTimeline } from './timeline';

const base = (over: Partial<BookingDetailDto>): BookingDetailDto =>
  ({ kind: 'urgent', status: 'en_route', createdAt: '2026-10-19T10:00:00.000Z', events: [], ...over }) as BookingDetailDto;

const ev = (id: string, toStatus: BookingDetailDto['status'], at: string) => ({ id, fromStatus: null, toStatus, actor: 'system' as const, note: null, lat: null, lng: null, createdAt: at });

describe('buildTimeline', () => {
  it('date les étapes passées, marque la courante et liste les suivantes', () => {
    const items = buildTimeline(
      base({
        status: 'en_route',
        events: [ev('1', 'pending_payment', '2026-10-19T10:00:00Z'), ev('2', 'searching', '2026-10-19T10:01:00Z'), ev('3', 'accepted', '2026-10-19T10:02:00Z'), ev('4', 'en_route', '2026-10-19T10:05:00Z')],
      }),
    );
    expect(items.map((i) => i.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(items[0]?.label).toBe("Recherche d'un artisan");
    expect(items.at(-1)?.label).toBe('Intervention terminée');
  });
  it("n'ajoute pas d'étapes à venir sur une intervention annulée", () => {
    const items = buildTimeline(base({ status: 'cancelled_by_client', events: [ev('1', 'searching', '2026-10-19T10:01:00Z'), ev('2', 'cancelled_by_client', '2026-10-19T10:03:00Z')] }));
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.state !== 'upcoming')).toBe(true);
  });
});

describe('buildTimeline : demandes de RDV et cas particuliers', () => {
  it('demande en attente : étape courante « Demande envoyée », puis confirmation à venir', () => {
    const items = buildTimeline(base({ kind: 'scheduled', status: 'requested', events: [ev('1', 'pending_payment', '2026-10-19T10:00:00Z'), ev('2', 'requested', '2026-10-19T10:01:00Z')] }));
    expect(items[0]).toMatchObject({ label: "Demande envoyée à l'artisan", state: 'current' });
    expect(items[1]).toMatchObject({ label: 'Artisan confirmé', state: 'upcoming' });
  });
  it('prix proposé : la proposition est une étape datée, sans répéter la demande', () => {
    const items = buildTimeline(
      base({
        kind: 'scheduled',
        status: 'pending_payment',
        priceOnRequest: true,
        artisanAccepted: true,
        events: [ev('1', 'pending_payment', '2026-10-19T10:00:00Z'), ev('2', 'requested', '2026-10-19T10:01:00Z'), { ...ev('3', 'pending_payment', '2026-10-19T11:00:00Z'), fromStatus: 'requested' as const }],
      }),
    );
    expect(items.map((i) => i.label).slice(0, 3)).toEqual(["Demande envoyée à l'artisan", "Prix proposé par l'artisan", 'Artisan confirmé']);
    expect(items[1]?.state).toBe('current');
  });
  it('intervention non réalisable : libellé explicite et aucune étape à venir', () => {
    const items = buildTimeline(
      base({
        kind: 'scheduled',
        status: 'awaiting_code',
        notFeasible: { reason: 'access_impossible', comment: null, photoUrls: [], rescheduledBookingId: null },
        events: [ev('1', 'accepted', '2026-10-19T10:00:00Z'), ev('2', 'arrived', '2026-10-19T11:00:00Z'), { ...ev('3', 'awaiting_code', '2026-10-19T11:10:00Z'), fromStatus: 'arrived' as const }],
      }),
    );
    expect(items.at(-1)?.label).toBe(NOT_FEASIBLE_LABEL);
    expect(items.some((i) => i.state === 'upcoming')).toBe(false);
  });
});
