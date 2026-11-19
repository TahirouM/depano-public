import type { ArtisanServiceDto, DomainCode } from '@depano/schemas';
import { and, artisanServices, eq, isNull, or, services } from '@depano/db';

/**
 * Offre d'un artisan telle que la voient les clients : motif actif côté artisan, service actif,
 * et soit du catalogue DEPANO, soit un motif personnel de CET artisan.
 */
export const offeredBy = (artisanId: string) =>
  and(
    eq(artisanServices.artisanId, artisanId),
    eq(artisanServices.active, true),
    eq(services.active, true),
    or(isNull(services.ownerArtisanId), eq(services.ownerArtisanId, artisanId)),
  );

/** Colonnes communes aux listes de prestations d'un artisan (jointure artisan_services ⨝ services). */
export const artisanServiceColumns = {
  serviceId: services.id,
  name: services.name,
  domain: services.domain,
  kind: services.kind,
  priceCents: artisanServices.priceCents,
  durationMinutes: artisanServices.durationMinutes,
  ownerArtisanId: services.ownerArtisanId,
  active: artisanServices.active,
};

interface ArtisanServiceRow {
  serviceId: string;
  name: string;
  domain: string;
  kind: ArtisanServiceDto['kind'];
  priceCents: number;
  durationMinutes: number;
  ownerArtisanId: string | null;
}

export const toArtisanServiceDto = (s: ArtisanServiceRow): ArtisanServiceDto => ({
  serviceId: s.serviceId,
  name: s.name,
  domain: s.domain as DomainCode,
  kind: s.kind,
  priceCents: s.priceCents,
  durationMinutes: s.durationMinutes,
  custom: s.ownerArtisanId != null,
});
