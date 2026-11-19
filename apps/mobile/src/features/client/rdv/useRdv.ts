import type { ArtisanServiceDto, DomainCode, ScheduledType, ServiceDto } from '@depano/schemas';
import { useMemo } from 'react';
import { useDomains } from '@/lib/query/hooks';
import { DRAFT_KEYS, useDraft } from '@/stores/drafts';
import type { ScheduledFlowDraft } from '../drafts';
import { useArtisan } from '../queries';

export const SCHEDULED_TYPE_LABELS: Record<ScheduledType, { title: string; hint: string }> = {
  maintenance: { title: 'Entretien', hint: 'Révision, détartrage, contrôle annuel' },
  repair: { title: 'Dépannage', hint: 'Quelque chose ne marche plus' },
};

/** Besoin hors catalogue (« Autre… ») : l'artisan chiffre la demande. */
export const PRICE_ON_REQUEST_LABEL = "Prix sur devis de l'artisan";

export interface RdvService extends ServiceDto {
  priceCents: number;
  durationMinutes: number;
}

/** Contexte commun aux 4 étapes du RDV : artisan, brouillon, prestations proposées. */
export function useRdv(artisanId: string | undefined) {
  const artisan = useArtisan(artisanId);
  const domains = useDomains();
  const [draft, patch, reset] = useDraft<ScheduledFlowDraft>(DRAFT_KEYS.scheduled(artisanId ?? 'none'));

  const domain: DomainCode | undefined = draft.domain ?? (artisan.data?.domains.length === 1 ? artisan.data.domains[0] : undefined);

  /**
   * Prestations de l'artisan, motifs personnels compris (absents du catalogue). Le catalogue ne sert
   * qu'à compléter (description, prix du marché) ; il peut encore charger.
   */
  const services = useMemo<RdvService[] | undefined>(() => {
    if (!artisan.data) return undefined;
    const catalog = new Map((domains.data ?? []).flatMap((d) => d.services).map((s) => [s.id, s] as const));
    return artisan.data.services.map((s: ArtisanServiceDto) => {
      const c = catalog.get(s.serviceId);
      return {
        id: s.serviceId,
        domain: s.domain,
        slug: c?.slug ?? `custom-${s.serviceId}`,
        name: s.name,
        description: c?.description ?? null,
        kind: s.kind,
        urgentEligible: c?.urgentEligible ?? false,
        referencePriceCents: c?.referencePriceCents ?? s.priceCents,
        defaultDurationMinutes: c?.defaultDurationMinutes ?? s.durationMinutes,
        priceCents: s.priceCents,
        durationMinutes: s.durationMinutes,
      };
    });
  }, [artisan.data, domains.data]);

  const ofKind = (kind: ScheduledType | undefined, d: DomainCode | undefined = domain) =>
    services?.filter((s) => (!d || s.domain === d) && (!kind || s.kind === kind || s.kind === 'both'));

  const selectedService = services?.find((s) => s.id === draft.serviceId);
  /** Besoin hors catalogue (« Autre… ») : pas de prix, l'artisan chiffrera la demande. */
  const priceOnRequest = !!draft.customReason;
  /** Prix de base : prestation choisie, sinon la moins chère du métier (comme l'API). */
  const prices = ofKind(undefined)?.map((s) => s.priceCents) ?? [];
  const basePriceCents = selectedService?.priceCents ?? (prices.length ? Math.min(...prices) : 0);

  return {
    artisan,
    domains,
    draft,
    patch,
    reset,
    domain,
    services,
    ofKind,
    selectedService,
    basePriceCents,
    priceOnRequest,
  };
}
