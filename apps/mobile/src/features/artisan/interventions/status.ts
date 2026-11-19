import type { BookingDetailDto, BookingStatus, ScheduledType } from '@depano/schemas';

/**
 * Bouton « Changer le statut » : étapes du déplacement à la fin des travaux, dérivées de
 * `allowedTransitions` (calculées par le serveur). Le devis avant travaux est obligatoire
 * (arrêté du 24 janvier 2017) : « Intervention en cours » n'est déclenchée que par le client
 * en validant le devis. Helpers purs, testés avec Vitest.
 */

export type StepKey = 'en_route' | 'arrived' | 'quote_pending' | 'in_progress' | 'awaiting_code';
/** Action déclenchée par l'étape : transition directe, écran devis, compte rendu ou code de fin. */
export type StepAction = 'en_route' | 'arrived' | 'quote' | 'report' | 'code';
export type StepState = 'done' | 'current' | 'next' | 'upcoming';

export interface StatusStep {
  key: StepKey;
  label: string;
  state: StepState;
  /** Présente seulement si l'artisan peut lancer l'étape maintenant. */
  action: StepAction | null;
  /** Pourquoi l'étape n'est pas disponible (lu par le lecteur d'écran). */
  hint: string | null;
}

type StatusInput = Pick<
  BookingDetailDto,
  'status' | 'allowedTransitions' | 'quote' | 'completionAttemptsLeft'
>;

const ORDER: StepKey[] = ['en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code'];

/** Position dans le parcours : -1 avant le départ, ORDER.length une fois clôturée. */
function position(status: BookingStatus): number | null {
  if (status === 'accepted') return -1;
  if (status === 'closed') return ORDER.length;
  const i = ORDER.indexOf(status as StepKey);
  return i >= 0 ? i : null;
}

export function quoteRefused(b: Pick<BookingDetailDto, 'status' | 'quote'>): boolean {
  return b.status === 'arrived' && (b.quote?.status === 'refused' || b.quote?.status === 'expired');
}

/** Étapes affichées dans le sélecteur de statut. Vide hors du parcours (demande, annulation, litige). */
export function statusSteps(b: StatusInput): StatusStep[] {
  const pos = position(b.status);
  if (pos == null) return [];
  const can = (s: BookingStatus) => b.allowedTransitions.includes(s);
  return ORDER.map((key, i): StatusStep => {
    const state: StepState =
      i < pos ? 'done' : i === pos ? 'current' : i === pos + 1 ? 'next' : 'upcoming';
    let label: string;
    let action: StepAction | null = null;
    let hint: string | null = null;
    switch (key) {
      case 'en_route':
        label = 'En route';
        if (state === 'next' && can('en_route')) action = 'en_route';
        break;
      case 'arrived':
        label = 'Sur place';
        if (state === 'next' && can('arrived')) action = 'arrived';
        break;
      case 'quote_pending':
        label = state === 'done' || state === 'current' ? 'Devis envoyé' : 'Envoyer le devis';
        if (state === 'next' && can('quote_pending')) {
          action = 'quote';
          if (quoteRefused(b)) label = 'Refaire le devis';
        } else if (state === 'upcoming') hint = 'Une fois sur place';
        break;
      case 'in_progress':
        label = 'Intervention en cours';
        if (state === 'next' || state === 'upcoming')
          hint = 'Démarre quand le client valide le devis dans son application';
        break;
      case 'awaiting_code':
        label = state === 'done' || state === 'current' ? 'Code de fin' : 'Terminer l’intervention';
        if (state === 'next' && can('awaiting_code') && b.status === 'in_progress')
          action = 'report';
        else if (state === 'current' && b.completionAttemptsLeft > 0) action = 'code';
        else if (state === 'upcoming') hint = 'Après le compte rendu';
        break;
    }
    return { key, label, state, action, hint };
  });
}

/** Prochaine action proposée en un tap (bouton principal du sélecteur), ou null. */
export function nextStep(b: StatusInput): StatusStep | null {
  return statusSteps(b).find((s) => s.action != null) ?? null;
}

/** Libellé de l'état courant, vu par l'artisan, pour la pastille du sélecteur. */
export function currentStepLabel(b: StatusInput): string | null {
  if (b.status === 'accepted') return 'Planifiée';
  if (b.status === 'closed') return 'Terminée';
  if (quoteRefused(b)) return b.quote?.status === 'expired' ? 'Devis expiré' : 'Devis refusé';
  return statusSteps(b).find((s) => s.state === 'current')?.label ?? null;
}

/** L'artisan peut déclarer l'intervention non réalisable (client absent, accès impossible…). */
export const NOT_FEASIBLE_STATUSES: readonly BookingStatus[] = [
  'en_route',
  'arrived',
  'in_progress',
];

export function canDeclareNotFeasible(
  b: Pick<BookingDetailDto, 'status' | 'notFeasible'>,
): boolean {
  return NOT_FEASIBLE_STATUSES.includes(b.status) && !b.notFeasible;
}

/** « Dépannage » / « Entretien » (maquette « Nature de l'intervention »). */
export function interventionNature(b: {
  kind: BookingDetailDto['kind'];
  scheduledType: ScheduledType | null;
}): string {
  if (b.kind === 'urgent') return 'Dépannage (urgence)';
  return b.scheduledType === 'maintenance' ? 'Entretien' : 'Dépannage';
}
