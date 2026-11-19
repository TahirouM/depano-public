import type { BookingDetailDto, DomainDto, ReportDto } from '@depano/schemas';

type Store = Record<string, unknown>;
type ServiceLike = { serviceId: string; kind?: string; custom?: boolean; active?: boolean };

/** Compte rendu d'exemple pour les interventions terminées enregistrées sans compte rendu. */
const SAMPLE_REPORT: Omit<ReportDto, 'createdAt'> = {
  feasible: true,
  materials: 'Joint fibre 20/27, raccord laiton, téflon.',
  notes:
    "Fuite localisée sur le raccord d'alimentation sous l'évier. Raccord remplacé, joints changés et étanchéité contrôlée pendant 10 minutes : plus aucune fuite.",
  voiceTranscript: null,
  followUpNeeded: false,
  beforePhotoUrls: [],
  afterPhotoUrls: [],
};

/**
 * Complète un enregistrement antérieur au contrat actuel : type et origine des prestations
 * (`kind`, `custom`, `active`), compte rendu des interventions terminées.
 */
export function normalizeRecording(store: Store, catalog: DomainDto[] | undefined): Store {
  const kindOf = new Map((catalog ?? []).flatMap((d) => d.services.map((s) => [s.id, s.kind] as const)));
  const fixServices = (list: ServiceLike[] | undefined, own: boolean) =>
    list?.forEach((s) => {
      s.kind ??= kindOf.get(s.serviceId) ?? 'both';
      s.custom ??= false;
      if (own) s.active ??= true;
    });
  for (const [key, value] of Object.entries(store)) {
    if (key === '/artisan/profile') fixServices((value as { services?: ServiceLike[] }).services, true);
    else if (/^\/artisans\/[^/?]+$/.test(key)) fixServices((value as { services?: ServiceLike[] }).services, false);
    else if (/^\/bookings\/[^/?]+$/.test(key)) {
      const b = value as BookingDetailDto;
      if (b.status === 'closed' && !b.report) b.report = { ...SAMPLE_REPORT, createdAt: b.scheduledAt ?? b.createdAt };
    }
  }
  return store;
}
