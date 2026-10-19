import { RULES, clientCancellationIsFree, clientDisputeBlockedReason, nextStatuses, type Actor, type BookingStatus } from '@depano/schemas';
import type { BookingRow } from './booking-state.service';

export type Viewer = { userId: string; actor: 'client' | 'artisan' | 'support'; artisanId?: string | null };

/** Retard de l'artisan (minutes) : au-delà de l'ETA annoncée ou de l'heure du RDV. */
export function artisanLateMinutes(b: BookingRow, now = new Date()) {
  const ref = b.status === 'en_route' && b.etaAt ? b.etaAt : b.status === 'accepted' && b.kind === 'scheduled' ? b.scheduledAt : null;
  if (!ref) return 0;
  return Math.max(0, (now.getTime() - ref.getTime()) / 60_000);
}

/** Conditions d'annulation côté client : gratuite ou frais de déplacement. */
export function clientCancellationTerms(b: BookingRow, now = new Date()) {
  const free = clientCancellationIsFree({
    scheduledAt: b.scheduledAt ?? b.acceptedAt ?? b.createdAt,
    now,
    hasGuarantee: b.withGuarantee,
    artisanLateMinutes: artisanLateMinutes(b, now),
    status: b.status,
  });
  return { free, feeCents: free ? 0 : b.travelFeeCents };
}

export function canReview(b: BookingRow, viewer: Viewer, hasReview: boolean, now = new Date()) {
  return (
    viewer.actor === 'client' &&
    b.status === 'closed' &&
    !hasReview &&
    !!b.closedAt &&
    now.getTime() - b.closedAt.getTime() <= RULES.reviewWindowDays * 86_400_000
  );
}

export const allowedTransitionsFor = (b: BookingRow, actor: Actor, now = new Date()) =>
  nextStatuses(b.status as BookingStatus, actor, b.kind).filter(
    (to) => !(to === 'disputed' && actor === 'client' && clientDisputeBlockedReason({ status: b.status as BookingStatus, scheduledAt: b.scheduledAt }, now)),
  );

/** Montant à capturer à la clôture : devis accepté, frais de déplacement seuls, sinon montant annoncé. */
export function closingAmount(b: BookingRow, acceptedQuoteTotal: number | null) {
  const base = b.travelOnly ? b.travelFeeCents : (acceptedQuoteTotal ?? b.totalCents);
  return Math.min(base, b.authorizedCents || base);
}

export const maskPhone = (phone: string | null) => (phone ? `${phone.slice(0, 4)} •• •• •• ${phone.slice(-2)}` : null);
export const approx = (v: number) => Math.round(v * 100) / 100;
