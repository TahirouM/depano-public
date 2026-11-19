import { DOMAIN_LABELS, RULES, chatIsOpen, type BookingDetailDto, type BookingSummaryDto } from '@depano/schemas';

type Summary = Pick<BookingSummaryDto, 'status' | 'priceOnRequest' | 'artisanAccepted' | 'rescheduledFromId'>;

/**
 * Proposition de l'artisan à accepter par le client (paiement d'une intervention existante) :
 * prix d'une demande « Autre », ou nouveau rendez-vous après une intervention non réalisable.
 */
export type Proposal = 'price' | 'reschedule';

export function proposalOf(b: Summary): Proposal | null {
  if (b.status !== 'pending_payment') return null;
  if (b.rescheduledFromId) return 'reschedule';
  if (b.priceOnRequest && b.artisanAccepted) return 'price';
  return null;
}

/** Messagerie ouverte : demande acceptée (ou chiffrée) par l'artisan. Miroir de `chatIsOpen` (schemas). */
export function chatOpenFor(b: Pick<BookingSummaryDto, 'status' | 'artisanAccepted'>): boolean {
  return chatIsOpen({ status: b.status, artisanAcceptedAt: b.artisanAccepted ? 'accepted' : null });
}

/** Demande de RDV « Autre » pas encore chiffrée : aucun prix à afficher. */
export function awaitingPrice(b: Pick<BookingSummaryDto, 'status' | 'priceOnRequest' | 'artisanAccepted'>): boolean {
  return b.priceOnRequest && !b.artisanAccepted && (b.status === 'requested' || b.status === 'pending_payment');
}

/**
 * Échéance de réponse de l'artisan : fournie par l'API (`requestExpiresAt`, liste et détail), sinon déduite de la règle
 * (24 h après la demande, ou l'heure du RDV si elle est plus proche).
 */
export function requestDeadline(b: Pick<BookingSummaryDto, 'createdAt' | 'scheduledAt'> & { requestExpiresAt?: string | null }): string {
  if (b.requestExpiresAt) return b.requestExpiresAt;
  const ttl = new Date(b.createdAt).getTime() + RULES.requestTtlHours * 3_600_000;
  const at = b.scheduledAt ? Math.min(ttl, new Date(b.scheduledAt).getTime()) : ttl;
  return new Date(at).toISOString();
}

/** Historique « Interventions réalisées » : terminées, et annulées après prise en charge par un artisan. */
export function isHistoryItem(b: Pick<BookingSummaryDto, 'status' | 'counterpart'>): boolean {
  if (b.status === 'closed' || b.status === 'disputed') return true;
  return (b.status === 'cancelled_by_client' || b.status === 'cancelled_by_artisan') && !!b.counterpart;
}

/** « Urgence Plomberie » / « Plomberie ». */
export function kindDomainLabel(b: Pick<BookingSummaryDto, 'kind' | 'domain'>): string {
  return b.kind === 'urgent' ? `Urgence ${DOMAIN_LABELS[b.domain]}` : DOMAIN_LABELS[b.domain];
}

const TZ = 'Europe/Paris';

/** « 15 février 2026 à 14h45 » (heure de Paris). */
export function formatDoneAt(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(d);
  const parts = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${day} à ${h}h${m}`;
}

/** Date de fin réelle (événement « closed »), sinon date prévue ou de création. */
export function doneAt(b: Pick<BookingDetailDto, 'events' | 'scheduledAt' | 'createdAt' | 'status'>): string {
  const closed = [...b.events].reverse().find((e) => e.toStatus === b.status);
  return closed?.createdAt ?? b.scheduledAt ?? b.createdAt;
}

/** Montant réellement payé (ou dû) pour une intervention terminée ou annulée. */
export function finalAmountCents(b: Pick<BookingDetailDto, 'capturedCents' | 'quote' | 'totalCents' | 'status' | 'cancellationFeeCents'>): number {
  if (b.capturedCents != null) return b.capturedCents;
  if (b.status === 'cancelled_by_client' || b.status === 'cancelled_by_artisan') return b.cancellationFeeCents;
  return b.quote?.status === 'accepted' ? b.quote.totalCents : b.totalCents;
}
