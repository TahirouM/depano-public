import { BOOKING_STATUS_LABELS, type BookingDetailDto, type BookingStatus } from '@depano/schemas';
import type { TimelineItem } from '@depano/ui';

const URGENT_PATH: BookingStatus[] = ['searching', 'accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed'];
const SCHEDULED_PATH: BookingStatus[] = ['accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed'];

const CLIENT_LABELS: Partial<Record<BookingStatus, string>> = {
  accepted: 'Artisan confirmé',
  quote_pending: 'Devis reçu',
  in_progress: 'Devis validé, travaux en cours',
  awaiting_code: 'Travaux terminés',
  closed: 'Intervention terminée',
};

/** Timeline datée (événements réels) + étapes à venir sur le parcours nominal. */
export function buildTimeline(b: BookingDetailDto): TimelineItem[] {
  const events = [...b.events].filter((e) => e.toStatus !== 'pending_payment').sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const items: TimelineItem[] = events.map((e, i) => ({
    key: e.id,
    label: CLIENT_LABELS[e.toStatus] ?? BOOKING_STATUS_LABELS[e.toStatus],
    at: e.createdAt,
    note: e.note,
    state: i === events.length - 1 && b.status !== 'closed' ? 'current' : 'done',
  }));
  const terminal = ['closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired', 'disputed'].includes(b.status);
  if (!terminal) {
    const path = b.kind === 'urgent' ? URGENT_PATH : SCHEDULED_PATH;
    const idx = path.indexOf(b.status);
    for (const s of path.slice(idx + 1)) {
      if (s === 'quote_pending' && idx >= path.indexOf('quote_pending')) continue;
      items.push({ key: `next-${s}`, label: CLIENT_LABELS[s] ?? BOOKING_STATUS_LABELS[s], state: 'upcoming' });
    }
  }
  if (!items.length) items.push({ key: 'now', label: BOOKING_STATUS_LABELS[b.status], at: b.createdAt, state: 'current' });
  return items;
}
