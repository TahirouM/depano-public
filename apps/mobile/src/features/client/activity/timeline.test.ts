import type { BookingDetailDto } from '@depano/schemas';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timeline';

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
