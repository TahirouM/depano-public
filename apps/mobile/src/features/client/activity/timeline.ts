import { BOOKING_STATUS_LABELS, type BookingDetailDto, type BookingEventDto, type BookingStatus } from '@depano/schemas';
import type { TimelineItem } from '@depano/ui';

const URGENT_PATH: BookingStatus[] = ['searching', 'accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed'];
const SCHEDULED_PATH: BookingStatus[] = ['requested', 'accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed'];

const CLIENT_LABELS: Partial<Record<BookingStatus, string>> = {
  requested: "Demande envoyée à l'artisan",
  accepted: 'Artisan confirmé',
  quote_pending: 'Devis reçu',
  in_progress: 'Devis validé, travaux en cours',
  awaiting_code: 'Travaux terminés',
  closed: 'Intervention terminée',
};

export const NOT_FEASIBLE_LABEL = 'Intervention non réalisable — frais de déplacement facturés';

function eventLabel(e: BookingEventDto, b: BookingDetailDto): string {
  // L'artisan a répondu à une demande « Autre » (ou proposé un nouveau RDV) : le client doit accepter.
  if (e.toStatus === 'pending_payment') return b.rescheduledFromId ? 'Nouveau rendez-vous proposé' : "Prix proposé par l'artisan";
  if (b.notFeasible && (e.toStatus === 'awaiting_code' || e.toStatus === 'closed') && e.fromStatus !== 'in_progress') {
    return e.toStatus === 'awaiting_code' ? NOT_FEASIBLE_LABEL : 'Intervention clôturée';
  }
  return CLIENT_LABELS[e.toStatus] ?? BOOKING_STATUS_LABELS[e.toStatus];
}

/** Timeline datée (événements réels) + étapes à venir sur le parcours nominal. */
export function buildTimeline(b: BookingDetailDto): TimelineItem[] {
  // Le paiement initial n'est pas une étape ; une proposition de l'artisan (après la demande) en est une.
  const events = [...b.events]
    .filter((e) => e.toStatus !== 'pending_payment' || e.fromStatus === 'requested')
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const items: TimelineItem[] = events.map((e, i) => ({
    key: e.id,
    label: eventLabel(e, b),
    at: e.createdAt,
    note: e.note,
    state: i === events.length - 1 && b.status !== 'closed' ? 'current' : 'done',
  }));
  const terminal = ['closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired', 'disputed'].includes(b.status);
  if (!terminal && !b.notFeasible) {
    const path = b.kind === 'urgent' ? URGENT_PATH : SCHEDULED_PATH;
    // Proposition en attente : on se place juste après la demande.
    const idx = b.status === 'pending_payment' ? path.indexOf('requested') : path.indexOf(b.status);
    if (idx >= 0 || b.status !== 'pending_payment') {
      for (const s of path.slice(idx + 1)) {
        if (s === 'quote_pending' && idx >= path.indexOf('quote_pending')) continue;
        items.push({ key: `next-${s}`, label: CLIENT_LABELS[s] ?? BOOKING_STATUS_LABELS[s], state: 'upcoming' });
      }
    }
  }
  if (!items.length) items.push({ key: 'now', label: BOOKING_STATUS_LABELS[b.status], at: b.createdAt, state: 'current' });
  return items;
}
