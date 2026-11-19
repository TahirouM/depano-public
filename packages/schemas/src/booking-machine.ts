import type { Actor, BookingKind, BookingStatus } from './enums';

/**
 * Machine à états unique des interventions. Le serveur est seul juge :
 * l'app ne fait que demander une transition, l'API vérifie l'acteur et l'état courant.
 */
export interface Transition {
  from: BookingStatus;
  to: BookingStatus;
  actors: readonly Actor[];
  /** Restreint la transition à un type de réservation. */
  kinds?: readonly BookingKind[];
}

const CLIENT: Actor[] = ['client'];
const ARTISAN: Actor[] = ['artisan'];
const SYSTEM: Actor[] = ['system'];
const SUPPORT: Actor[] = ['support'];

export const BOOKING_TRANSITIONS: readonly Transition[] = [
  // Empreinte bancaire validée : l'urgence part au dispatch, le RDV attend la réponse de l'artisan
  // (ou est confirmé directement si l'artisan a déjà accepté : prix proposé, report).
  { from: 'pending_payment', to: 'searching', actors: SYSTEM, kinds: ['urgent'] },
  { from: 'pending_payment', to: 'requested', actors: SYSTEM, kinds: ['scheduled'] },
  { from: 'pending_payment', to: 'accepted', actors: SYSTEM, kinds: ['scheduled'] },
  { from: 'pending_payment', to: 'cancelled_by_client', actors: [...CLIENT, 'system'] },

  // Demande de RDV : l'artisan accepte, refuse, ou chiffre une demande « Autre » (le client paie alors le prix proposé)
  { from: 'requested', to: 'accepted', actors: ARTISAN, kinds: ['scheduled'] },
  { from: 'requested', to: 'pending_payment', actors: ARTISAN, kinds: ['scheduled'] },
  { from: 'requested', to: 'cancelled_by_artisan', actors: ARTISAN },
  { from: 'requested', to: 'cancelled_by_client', actors: CLIENT },
  { from: 'requested', to: 'expired', actors: SYSTEM },

  // Dispatch urgence
  { from: 'searching', to: 'accepted', actors: [...ARTISAN, 'system'], kinds: ['urgent'] },
  { from: 'searching', to: 'expired', actors: SYSTEM, kinds: ['urgent'] },
  { from: 'searching', to: 'cancelled_by_client', actors: CLIENT },

  // Déplacement
  { from: 'accepted', to: 'en_route', actors: ARTISAN },
  { from: 'accepted', to: 'cancelled_by_client', actors: CLIENT },
  { from: 'accepted', to: 'cancelled_by_artisan', actors: ARTISAN },
  { from: 'en_route', to: 'arrived', actors: [...ARTISAN, 'system'] },
  { from: 'en_route', to: 'cancelled_by_client', actors: CLIENT },
  { from: 'en_route', to: 'cancelled_by_artisan', actors: ARTISAN },

  // Devis obligatoire avant toute prestation (arrêté du 24 janvier 2017)
  { from: 'arrived', to: 'quote_pending', actors: ARTISAN },
  { from: 'quote_pending', to: 'in_progress', actors: CLIENT },
  { from: 'quote_pending', to: 'arrived', actors: [...CLIENT, 'system'] }, // devis refusé ou expiré
  // « Déplacement seulement » / intervention non réalisable : frais de déplacement uniquement
  { from: 'arrived', to: 'awaiting_code', actors: ARTISAN },

  // Fin des travaux
  { from: 'in_progress', to: 'awaiting_code', actors: ARTISAN },
  { from: 'awaiting_code', to: 'closed', actors: [...ARTISAN, 'system'] },

  // Litiges : la capture est gelée
  ...(['accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code'] as const).map(
    (from): Transition => ({ from, to: 'disputed', actors: [...CLIENT, 'support'] }),
  ),
  { from: 'disputed', to: 'closed', actors: SUPPORT },
  { from: 'disputed', to: 'cancelled_by_artisan', actors: SUPPORT },
  { from: 'disputed', to: 'cancelled_by_client', actors: SUPPORT },
];

export function findTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: Actor,
  kind: BookingKind,
): Transition | undefined {
  return BOOKING_TRANSITIONS.find(
    (t) => t.from === from && t.to === to && t.actors.includes(actor) && (!t.kinds || t.kinds.includes(kind)),
  );
}

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor, kind: BookingKind): boolean {
  return findTransition(from, to, actor, kind) !== undefined;
}

/** Transitions qu'un acteur peut déclencher depuis un état (pour afficher les bons boutons). */
export function nextStatuses(from: BookingStatus, actor: Actor, kind: BookingKind): BookingStatus[] {
  return BOOKING_TRANSITIONS.filter(
    (t) => t.from === from && t.actors.includes(actor) && (!t.kinds || t.kinds.includes(kind)),
  ).map((t) => t.to);
}

/** L'artisan ne voit l'adresse exacte du client qu'à partir de l'acceptation. */
export function artisanCanSeeExactAddress(status: BookingStatus): boolean {
  return !['pending_payment', 'requested', 'searching', 'expired'].includes(status);
}

/** La messagerie n'est ouverte qu'une fois la demande acceptée (ou chiffrée) par l'artisan. */
export function chatIsOpen(b: { status: BookingStatus; artisanAcceptedAt: Date | string | null }): boolean {
  if (['requested', 'searching', 'expired'].includes(b.status)) return false;
  if (b.status === 'pending_payment') return b.artisanAcceptedAt != null;
  return true;
}

/**
 * Garde métier en plus de la machine à états : un RDV planifié encore « accepted » dont l'heure n'est pas arrivée ne
 * peut pas faire l'objet d'un litige client (pas de « technicien jamais venu » avant le rendez-vous ; le client peut
 * annuler). Renvoie le message d'erreur à afficher, ou null si le litige est possible.
 */
export function clientDisputeBlockedReason(
  b: { status: BookingStatus; scheduledAt: Date | string | null },
  now: Date = new Date(),
): string | null {
  if (b.status !== 'accepted' || !b.scheduledAt) return null;
  const at = typeof b.scheduledAt === 'string' ? new Date(b.scheduledAt) : b.scheduledAt;
  if (at.getTime() <= now.getTime()) return null;
  return "Le rendez-vous n'a pas encore eu lieu : vous pourrez signaler un problème à partir de l'heure prévue. Pour changer vos plans, annulez ou contactez l'artisan.";
}
