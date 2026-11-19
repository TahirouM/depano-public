import type { BookingDetailDto } from '@depano/schemas';
import { describe, expect, it } from 'vitest';
import {
  canDeclareNotFeasible,
  currentStepLabel,
  interventionNature,
  nextStep,
  statusSteps,
} from './status';

type In = Parameters<typeof statusSteps>[0];
const b = (p: Partial<In>): In => ({
  status: 'accepted',
  allowedTransitions: [],
  quote: null,
  completionAttemptsLeft: 3,
  ...p,
});
const quote = (status: NonNullable<BookingDetailDto['quote']>['status']) =>
  ({ status }) as NonNullable<BookingDetailDto['quote']>;

describe('bouton « Changer le statut »', () => {
  it('acceptée : « En route » est la prochaine étape', () => {
    const x = b({ allowedTransitions: ['en_route', 'cancelled_by_artisan'] });
    expect(nextStep(x)).toMatchObject({ key: 'en_route', action: 'en_route', label: 'En route' });
    expect(currentStepLabel(x)).toBe('Planifiée');
    expect(statusSteps(x).map((s) => s.state)).toEqual([
      'next',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('en route : « Sur place »', () => {
    const x = b({ status: 'en_route', allowedTransitions: ['arrived', 'cancelled_by_artisan'] });
    expect(nextStep(x)).toMatchObject({ key: 'arrived', action: 'arrived', label: 'Sur place' });
    expect(currentStepLabel(x)).toBe('En route');
  });

  it('sur place : le devis est l’étape suivante (obligatoire)', () => {
    const x = b({ status: 'arrived', allowedTransitions: ['quote_pending', 'awaiting_code'] });
    expect(nextStep(x)).toMatchObject({ action: 'quote', label: 'Envoyer le devis' });
    const inProgress = statusSteps(x).find((s) => s.key === 'in_progress')!;
    expect(inProgress.action).toBeNull();
    expect(inProgress.hint).toMatch(/client valide le devis/);
  });

  it('devis refusé : « Refaire le devis »', () => {
    const x = b({
      status: 'arrived',
      allowedTransitions: ['quote_pending'],
      quote: quote('refused'),
    });
    expect(nextStep(x)?.label).toBe('Refaire le devis');
    expect(currentStepLabel(x)).toBe('Devis refusé');
  });

  it('devis envoyé : rien à faire, le client valide', () => {
    const x = b({ status: 'quote_pending', allowedTransitions: [], quote: quote('sent') });
    expect(nextStep(x)).toBeNull();
    expect(currentStepLabel(x)).toBe('Devis envoyé');
  });

  it('en cours : terminer via le compte rendu', () => {
    const x = b({
      status: 'in_progress',
      allowedTransitions: ['awaiting_code'],
      quote: quote('accepted'),
    });
    expect(currentStepLabel(x)).toBe('Intervention en cours');
    expect(nextStep(x)).toMatchObject({ key: 'awaiting_code', action: 'report' });
  });

  it('code de fin : saisie tant qu’il reste des essais', () => {
    expect(nextStep(b({ status: 'awaiting_code' }))?.action).toBe('code');
    expect(nextStep(b({ status: 'awaiting_code', completionAttemptsLeft: 0 }))).toBeNull();
  });

  it('transition refusée par le serveur : pas d’action', () => {
    expect(nextStep(b({ status: 'en_route', allowedTransitions: [] }))).toBeNull();
  });

  it('hors parcours (demande, annulée) : aucune étape', () => {
    expect(statusSteps(b({ status: 'requested' }))).toEqual([]);
    expect(statusSteps(b({ status: 'cancelled_by_client' }))).toEqual([]);
    expect(statusSteps(b({ status: 'closed' })).every((s) => s.state === 'done')).toBe(true);
  });
});

describe('intervention non réalisable', () => {
  it('possible en route, sur place ou en cours, une seule fois', () => {
    expect(canDeclareNotFeasible({ status: 'en_route', notFeasible: null })).toBe(true);
    expect(canDeclareNotFeasible({ status: 'arrived', notFeasible: null })).toBe(true);
    expect(canDeclareNotFeasible({ status: 'accepted', notFeasible: null })).toBe(false);
    expect(
      canDeclareNotFeasible({
        status: 'arrived',
        notFeasible: {
          reason: 'client_absent',
          comment: null,
          photoUrls: [],
          rescheduledBookingId: null,
        },
      }),
    ).toBe(false);
  });
  it('nature', () => {
    expect(interventionNature({ kind: 'scheduled', scheduledType: 'maintenance' })).toBe(
      'Entretien',
    );
    expect(interventionNature({ kind: 'scheduled', scheduledType: 'repair' })).toBe('Dépannage');
    expect(interventionNature({ kind: 'urgent', scheduledType: null })).toBe('Dépannage (urgence)');
  });
});
