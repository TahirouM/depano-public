import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ACTIVE_BOOKING_STATUSES,
  type ArtisanDashboardDto,
  type ArtisanDocumentBody,
  type ArtisanDocumentDto,
  type ArtisanPrivateProfileDto,
  type ArtisanProfileBody,
  type ArtisanServicesBody,
  type ArtisanStatsDto,
  type AvailabilityExceptionBody,
  type AvailabilityExceptionDto,
  type AvailabilityRulesBody,
  type CompanyInfoDto,
  type CustomServiceBody,
  type DocumentType,
  type DomainCode,
  type EarningsDto,
  type EventColor,
  type KycChecklistDto,
  type PlanningDto,
  type QualificationBadge,
  type UrgentAvailabilityBody,
} from '@depano/schemas';
import {
  and,
  artisanDocuments,
  artisanProfiles,
  artisanServices,
  asc,
  availabilityExceptions,
  availabilityRules,
  bookings,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  services,
  sql,
  users,
} from '@depano/db';
import { AppConfig } from '../../config/config.service';
import { DbConnection } from '../../infra/db';
import { FilesService } from '../files/files.service';
import { PaymentsService } from '../payments/payments.service';
import { BookingMapper } from '../bookings/booking-mapper.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { ReliabilityService } from '../maintenance/reliability.service';
import { MeService } from '../me/me.service';
import { PromotionService } from './promotion.service';
import { artisanServiceColumns, toArtisanServiceDto } from '../catalog/offer';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { parisStartOfDay, parisToUtc, addDays, parisDate } from '../../common/time';

type ProfileRow = typeof artisanProfiles.$inferSelect;

/** Nombre maximal de motifs personnels par artisan. */
const MAX_CUSTOM_SERVICES = 30;
type DocumentRow = typeof artisanDocuments.$inferSelect;

/**
 * Normalise un code APE / NAF quel que soit le format renvoyé par les répertoires :
 * « 43.22A » (SIRENE), « 4322A », « 43.22.A », « 4322AZ » (répertoire des métiers), « 43.22G » (NAF 2025)…
 * Renvoie « 43.22A » (division.groupe + lettre) ou null.
 */
export function normalizeApe(ape: string | null | undefined): string | null {
  const m = /^(\d{2})\.?(\d{2})\.?([A-Z])?[A-Z]?$/.exec((ape ?? '').replace(/[\s_-]/g, '').toUpperCase());
  if (!m) return null;
  return `${m[1]}.${m[2]}${m[3] ?? ''}`;
}

/** Codes APE → métiers DEPANO (43.22 : plomberie + chauffage/énergétique ; 43.21 : électricité). */
export function domainsForApe(...apes: (string | null | undefined)[]): DomainCode[] {
  const out = new Set<DomainCode>();
  for (const ape of apes) {
    const code = normalizeApe(ape);
    if (!code) continue;
    if (code.startsWith('43.22')) (['plomberie', 'energetique'] as const).forEach((d) => out.add(d));
    if (code.startsWith('43.21')) out.add('electricite');
  }
  return (['plomberie', 'electricite', 'energetique'] as const).filter((d) => out.has(d));
}

/** Libellés des codes APE du bâtiment (l'API Recherche d'entreprises ne renvoie plus toujours le libellé). */
const APE_LABELS: Record<string, string> = {
  '43.21A': "Travaux d'installation électrique dans tous locaux",
  '43.21B': "Travaux d'installation électrique sur la voie publique",
  '43.22A': "Travaux d'installation d'eau et de gaz en tous locaux",
  '43.22B': "Travaux d'installation d'équipements thermiques et de climatisation",
};

interface EntrepriseResult {
  siren: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  activite_principale?: string;
  activite_principale_naf25?: string;
  libelle_activite_principale?: string;
  etat_administratif?: string;
  siege?: Etablissement;
  matching_etablissements?: Etablissement[];
}
interface Etablissement {
  siret: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  activite_principale?: string;
  activite_principale_naf25?: string;
  activite_principale_registre_metier?: string;
  etat_administratif?: string;
}

@Injectable()
export class ArtisanService {
  private readonly logger = new Logger('Artisan');

  constructor(
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(BookingMapper) private readonly mapper: BookingMapper,
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(ReliabilityService) private readonly reliability: ReliabilityService,
    @Inject(MeService) private readonly me: MeService,
    @Inject(PromotionService) private readonly promotion: PromotionService,
  ) {}

  async profileRow(id: string) {
    const [p] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.id, id));
    if (!p) throw notFound('artisan_not_found', 'Profil artisan introuvable.');
    return p;
  }

  /* -------------------------------- SIRET ------------------------------ */

  async fetchCompany(siret: string): Promise<CompanyInfoDto | null> {
    const fallback: CompanyInfoDto = {
      siret,
      siren: siret.slice(0, 9),
      name: '',
      address: '',
      postalCode: null,
      city: null,
      apeCode: null,
      apeLabel: null,
      active: false,
      suggestedDomains: [],
      apeMatchesTrade: false,
    };
    if (this.config.env.OFFLINE_MODE) return fallback;
    let json: { results?: EntrepriseResult[] };
    try {
      const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siret)}&page=1&per_page=1`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      json = (await res.json()) as typeof json;
    } catch (e) {
      // Service indisponible : on enregistre le SIRET, la vérification sera refaite par l'admin.
      this.logger.warn(`API Recherche d'entreprises indisponible : ${e}`);
      return fallback;
    }
    const r = json.results?.[0];
    if (!r) return null;
    const etab = r.matching_etablissements?.find((e) => e.siret === siret) ?? (r.siege?.siret === siret ? r.siege : undefined);
    if (!etab && r.siren !== siret.slice(0, 9)) return null;
    const rawApe = etab?.activite_principale ?? r.activite_principale ?? null;
    const ape = normalizeApe(rawApe) ?? rawApe;
    // Tous les codes connus de l'établissement et de l'unité légale (NAF 2008, NAF 2025, répertoire des métiers).
    const suggested = domainsForApe(
      etab?.activite_principale,
      etab?.activite_principale_registre_metier,
      r.activite_principale,
      etab?.activite_principale_naf25,
      r.activite_principale_naf25,
    );
    return {
      siret,
      siren: r.siren,
      name: r.nom_raison_sociale ?? r.nom_complet ?? '',
      address: etab?.adresse ?? r.siege?.adresse ?? '',
      postalCode: etab?.code_postal ?? r.siege?.code_postal ?? null,
      city: etab?.libelle_commune ?? r.siege?.libelle_commune ?? null,
      apeCode: ape,
      apeLabel: r.libelle_activite_principale ?? (ape ? APE_LABELS[ape] ?? null : null),
      active: r.etat_administratif === 'A' && (etab?.etat_administratif ?? 'A') === 'A',
      suggestedDomains: suggested,
      apeMatchesTrade: suggested.length > 0,
    };
  }

  async lookupSiret(userId: string, siret: string): Promise<CompanyInfoDto> {
    const info = await this.fetchCompany(siret);
    if (!info) throw notFound('siret_not_found', 'SIRET introuvable dans le répertoire des entreprises.');
    // Contrôle avant de créer le brouillon : un SIRET déjà pris ne doit pas transformer le compte en artisan.
    const [other] = await this.conn.db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(and(eq(artisanProfiles.siret, siret), ne(artisanProfiles.userId, userId)));
    if (other) throw conflict('siret_taken', 'Ce SIRET est déjà associé à un autre compte artisan.');
    const profile = await this.me.ensureArtisanDraft(userId, { displayName: info.name || undefined });
    if (!['draft', 'rejected'].includes(profile.status) && profile.siret !== siret) {
      throw conflict('siret_locked', 'Le SIRET ne peut plus être modifié après la soumission du dossier.');
    }
    const verified = info.name !== '';
    await this.conn.db
      .update(artisanProfiles)
      .set({
        siret,
        companyName: info.name || profile.companyName,
        companyAddress: info.address ? [info.address].join(', ') : profile.companyAddress,
        apeCode: info.apeCode,
        companyActive: verified ? info.active : null,
        ...(profile.domains.length === 0 && info.suggestedDomains.length ? { domains: info.suggestedDomains } : {}),
        ...(profile.baseCity ? {} : info.city ? { baseCity: info.city } : {}),
      })
      .where(eq(artisanProfiles.id, profile.id));
    return info;
  }

  /* ------------------------------- Profil ------------------------------ */

  private async documents(artisanId: string) {
    return this.conn.db.select().from(artisanDocuments).where(eq(artisanDocuments.artisanId, artisanId)).orderBy(desc(artisanDocuments.createdAt));
  }

  async toDocumentDto(d: DocumentRow): Promise<ArtisanDocumentDto> {
    return {
      id: d.id,
      type: d.type,
      status: d.status,
      label: d.label,
      expiresAt: d.expiresAt ?? null,
      rejectionReason: d.rejectionReason,
      fileUrl: (await this.filesService.signedUrl(d.fileId)) ?? '',
      createdAt: d.createdAt.toISOString(),
    };
  }

  /** Dernier document de chaque type. */
  private latestByType(docs: DocumentRow[]) {
    const m = new Map<DocumentType, DocumentRow>();
    for (const d of docs) if (!m.has(d.type as DocumentType)) m.set(d.type as DocumentType, d);
    return m;
  }

  checklist(p: ProfileRow, ctx: { services: number; rules: number; docs: DocumentRow[] }): KycChecklistDto {
    const latest = this.latestByType(ctx.docs);
    const today = new Date().toISOString().slice(0, 10);
    const valid = (d?: DocumentRow) => !!d && ['pending', 'approved'].includes(d.status) && (!d.expiresAt || d.expiresAt >= today);
    return {
      siret: (!!p.siret || this.config.env.ARTISAN_SIRET_OPTIONAL) && p.companyActive !== false,
      domains: p.domains.length > 0,
      services: ctx.services > 0,
      zone: p.baseLat != null && p.baseLng != null && p.radiusKm > 0,
      availability: ctx.rules > 0,
      identity: valid(latest.get('identity')),
      insurance: valid(latest.get('insurance_decennale')) || valid(latest.get('insurance_rc_pro')),
      payouts: !!p.stripeAccountId && p.payoutsEnabled,
    };
  }

  async toPrivate(p: ProfileRow): Promise<ArtisanPrivateProfileDto> {
    const db = this.conn.db;
    const [svc, rules, docs, [user]] = await Promise.all([
      // Toutes les prestations de l'artisan, actives et désactivées (hors services retirés du catalogue).
      db
        .select(artisanServiceColumns)
        .from(artisanServices)
        .innerJoin(services, eq(services.id, artisanServices.serviceId))
        .where(and(eq(artisanServices.artisanId, p.id), eq(services.active, true)))
        .orderBy(asc(services.domain), asc(services.sortOrder), asc(services.name)),
      db.select().from(availabilityRules).where(eq(availabilityRules.artisanId, p.id)).orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime)),
      this.documents(p.id),
      db.select({ avatar: users.avatarFileId }).from(users).where(eq(users.id, p.userId)),
    ]);
    return {
      id: p.id,
      status: p.status,
      rejectionReason: p.rejectionReason,
      siret: p.siret,
      companyName: p.companyName,
      companyAddress: p.companyAddress,
      apeCode: p.apeCode,
      displayName: p.displayName,
      bio: p.bio,
      domains: p.domains as DomainCode[],
      baseLat: p.baseLat,
      baseLng: p.baseLng,
      baseCity: p.baseCity,
      radiusKm: p.radiusKm,
      travelFeeCents: p.travelFeeCents,
      qualifications: p.qualifications as QualificationBadge[],
      urgentAvailable: p.urgentAvailable,
      reliabilityScore: p.reliabilityScore,
      stripeAccountId: p.stripeAccountId,
      payoutsEnabled: p.payoutsEnabled,
      services: svc.map((s) => ({ ...toArtisanServiceDto(s), active: s.active })),
      availabilityRules: rules.map((r) => ({ weekday: r.weekday, start: r.startTime, end: r.endTime })),
      documents: await Promise.all(docs.map((d) => this.toDocumentDto(d))),
      portfolioUrls: await this.filesService.signedUrls(p.portfolioFileIds),
      portfolioFileIds: p.portfolioFileIds,
      bannerUrl: await this.filesService.signedUrl(p.bannerFileId),
      avatarUrl: await this.filesService.signedUrl(user?.avatar),
      promotion: this.promotion.toDto(p),
      checklist: this.checklist(p, { services: svc.filter((s) => s.active).length, rules: rules.length, docs }),
      submittedAt: p.submittedAt?.toISOString() ?? null,
      approvedAt: p.approvedAt?.toISOString() ?? null,
    };
  }

  async profile(artisanId: string) {
    return this.toPrivate(await this.profileRow(artisanId));
  }

  async updateProfile(artisan: { id: string; userId: string }, body: ArtisanProfileBody) {
    if (body.portfolioFileIds) await this.filesService.assertOwned(artisan.userId, body.portfolioFileIds, ['portfolio']);
    // Bannière : photo dédiée ou l'une des réalisations.
    if (body.bannerFileId) await this.filesService.assertOwned(artisan.userId, [body.bannerFileId], ['banner', 'portfolio']);
    const patch = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length) await this.conn.db.update(artisanProfiles).set(patch).where(eq(artisanProfiles.id, artisan.id));
    return this.profile(artisan.id);
  }

  /**
   * Tarifs de l'artisan. Les lignes `active: false` sont conservées (prix gardé, invisibles des clients).
   * Les services du catalogue absents du corps sont retirés ; les motifs personnels absents restent intacts
   * (seul DELETE /artisan/services/custom/:id les supprime).
   */
  async setServices(artisan: { id: string }, body: ArtisanServicesBody) {
    const p = await this.profileRow(artisan.id);
    const ids = [...new Set(body.services.map((s) => s.serviceId))];
    if (ids.length !== body.services.length) throw badRequest('duplicate_service', 'Une prestation est présente plusieurs fois.');
    if (ids.length) {
      const rows = await this.conn.db.select().from(services).where(inArray(services.id, ids));
      const byId = new Map(rows.map((r) => [r.id, r]));
      const invalid = (r: (typeof rows)[number] | undefined) => !r || !r.active || (r.ownerArtisanId != null && r.ownerArtisanId !== artisan.id);
      if (ids.some((id) => invalid(byId.get(id)))) throw badRequest('invalid_service', 'Prestation inconnue ou inactive.');
      // Un motif désactivé d'un métier abandonné peut rester en sommeil ; seuls les motifs actifs sont contrôlés.
      if (body.services.some((s) => s.active && !p.domains.includes(byId.get(s.serviceId)!.domain))) {
        throw badRequest('invalid_domain', 'Prestation hors de vos métiers déclarés.');
      }
    }
    await this.conn.db.transaction(async (tx) => {
      const catalog = await tx
        .select({ id: artisanServices.id, serviceId: artisanServices.serviceId })
        .from(artisanServices)
        .innerJoin(services, eq(services.id, artisanServices.serviceId))
        .where(and(eq(artisanServices.artisanId, artisan.id), isNull(services.ownerArtisanId)));
      const removed = catalog.filter((r) => !ids.includes(r.serviceId)).map((r) => r.id);
      if (removed.length) await tx.delete(artisanServices).where(inArray(artisanServices.id, removed));
      if (body.services.length) {
        await tx
          .insert(artisanServices)
          .values(body.services.map((s) => ({ artisanId: artisan.id, ...s })))
          .onConflictDoUpdate({
            target: [artisanServices.artisanId, artisanServices.serviceId],
            set: {
              priceCents: sql`excluded.price_cents`,
              durationMinutes: sql`excluded.duration_minutes`,
              active: sql`excluded.active`,
              updatedAt: new Date(),
            },
          });
      }
    });
    return this.profile(artisan.id);
  }

  /** Motif personnel (hors catalogue) : visible uniquement sur le profil de son auteur, jamais en urgence. */
  async addCustomService(artisan: { id: string }, body: CustomServiceBody) {
    const p = await this.profileRow(artisan.id);
    if (!p.domains.includes(body.domain)) throw badRequest('invalid_domain', 'Prestation hors de vos métiers déclarés.');
    const own = await this.conn.db
      .select({ name: services.name })
      .from(services)
      .where(and(eq(services.ownerArtisanId, artisan.id), eq(services.active, true)));
    if (own.length >= MAX_CUSTOM_SERVICES) {
      throw conflict('custom_services_limit', `Vous avez atteint la limite de ${MAX_CUSTOM_SERVICES} motifs personnels.`);
    }
    const name = body.name.replace(/\s+/g, ' ').trim();
    if (own.some((s) => s.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) {
      throw conflict('custom_service_exists', 'Vous avez déjà un motif portant ce nom.');
    }
    await this.conn.db.transaction(async (tx) => {
      const [svc] = await tx
        .insert(services)
        .values({
          domain: body.domain,
          slug: `custom-${randomUUID()}`,
          name,
          kind: body.kind,
          urgentEligible: false,
          referencePriceCents: body.priceCents,
          defaultDurationMinutes: body.durationMinutes,
          sortOrder: 1000,
          ownerArtisanId: artisan.id,
        })
        .returning({ id: services.id });
      await tx.insert(artisanServices).values({
        artisanId: artisan.id,
        serviceId: svc!.id,
        priceCents: body.priceCents,
        durationMinutes: body.durationMinutes,
        active: true,
      });
    });
    return this.profile(artisan.id);
  }

  /**
   * Suppression définitive d'un motif personnel. Le service est conservé (désactivé) s'il est référencé par une
   * intervention, pour l'historique et les factures.
   */
  async deleteCustomService(artisan: { id: string }, serviceId: string) {
    const db = this.conn.db;
    const [svc] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.ownerArtisanId, artisan.id), eq(services.active, true)));
    if (!svc) throw notFound('service_not_found', 'Motif introuvable.');
    await db.transaction(async (tx) => {
      await tx.delete(artisanServices).where(and(eq(artisanServices.artisanId, artisan.id), eq(artisanServices.serviceId, serviceId)));
      const [used] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.serviceId, serviceId)).limit(1);
      if (used) await tx.update(services).set({ active: false }).where(eq(services.id, serviceId));
      else await tx.delete(services).where(eq(services.id, serviceId));
    });
    return this.profile(artisan.id);
  }

  async setAvailabilityRules(artisan: { id: string }, body: AvailabilityRulesBody) {
    for (const r of body.rules) if (r.start >= r.end) throw badRequest('invalid_rule', `Plage horaire invalide (${r.start}–${r.end}).`);
    await this.conn.db.transaction(async (tx) => {
      await tx.delete(availabilityRules).where(eq(availabilityRules.artisanId, artisan.id));
      if (body.rules.length) {
        await tx.insert(availabilityRules).values(body.rules.map((r) => ({ artisanId: artisan.id, weekday: r.weekday, startTime: r.start, endTime: r.end })));
      }
    });
    return this.profile(artisan.id);
  }

  private toExceptionDto = (e: typeof availabilityExceptions.$inferSelect): AvailabilityExceptionDto => ({
    id: e.id,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    reason: e.reason,
    kind: e.kind,
    color: (e.color as EventColor | null) ?? null,
  });

  async exceptions(artisan: { id: string }) {
    const rows = await this.conn.db
      .select()
      .from(availabilityExceptions)
      .where(and(eq(availabilityExceptions.artisanId, artisan.id), gt(availabilityExceptions.endsAt, new Date())))
      .orderBy(asc(availabilityExceptions.startsAt));
    return rows.map(this.toExceptionDto);
  }

  async addException(artisan: { id: string }, body: AvailabilityExceptionBody) {
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (endsAt <= startsAt) throw badRequest('invalid_range', 'La fin doit être postérieure au début.');
    const [e] = await this.conn.db
      .insert(availabilityExceptions)
      .values({ artisanId: artisan.id, startsAt, endsAt, reason: body.reason ?? null, kind: body.kind, color: body.color ?? null })
      .returning();
    return this.toExceptionDto(e!);
  }

  async deleteException(artisan: { id: string }, id: string) {
    const r = await this.conn.db
      .delete(availabilityExceptions)
      .where(and(eq(availabilityExceptions.id, id), eq(availabilityExceptions.artisanId, artisan.id)))
      .returning({ id: availabilityExceptions.id });
    if (!r.length) throw notFound('exception_not_found', 'Indisponibilité ou événement introuvable.');
  }

  async addDocument(artisan: { id: string; userId: string }, body: ArtisanDocumentBody) {
    await this.filesService.assertOwned(artisan.userId, [body.fileId], ['document']);
    const [d] = await this.conn.db
      .insert(artisanDocuments)
      .values({ artisanId: artisan.id, type: body.type, fileId: body.fileId, expiresAt: body.expiresAt ?? null, label: body.label ?? null })
      .returning();
    return this.toDocumentDto(d!);
  }

  async payoutOnboardingLink(artisan: { id: string; userId: string }) {
    const p = await this.profileRow(artisan.id);
    const [u] = await this.conn.db.select({ email: users.email }).from(users).where(eq(users.id, artisan.userId));
    let accountId = p.stripeAccountId;
    if (!accountId) {
      accountId = await this.payments.provider.createConnectedAccount({ artisanId: p.id, email: u?.email ?? null, companyName: p.companyName });
      await this.conn.db.update(artisanProfiles).set({ stripeAccountId: accountId }).where(eq(artisanProfiles.id, p.id));
    }
    if (this.payments.provider.name === 'fake') {
      // En dev, l'onboarding factice active immédiatement les virements.
      await this.conn.db.update(artisanProfiles).set({ payoutsEnabled: true }).where(eq(artisanProfiles.id, p.id));
    }
    const base = this.config.env.API_PUBLIC_URL;
    const url = await this.payments.provider.createAccountLink(accountId, `${base}/v1/artisan/payouts/return`, `${base}/v1/artisan/payouts/refresh`);
    return { url };
  }

  async submit(artisan: { id: string }) {
    const p = await this.profileRow(artisan.id);
    if (!['draft', 'rejected'].includes(p.status)) throw conflict('already_submitted', 'Votre dossier a déjà été soumis.');
    const dto = await this.toPrivate(p);
    const missing = Object.entries(dto.checklist).filter(([, ok]) => !ok).map(([k]) => k);
    if (missing.length) throw badRequest('checklist_incomplete', 'Votre dossier est incomplet.', { missing, checklist: dto.checklist });
    await this.conn.db.update(artisanProfiles).set({ status: 'pending_review', submittedAt: new Date(), rejectionReason: null }).where(eq(artisanProfiles.id, p.id));
    return this.profile(p.id);
  }

  async setUrgentAvailability(artisan: { id: string }, body: UrgentAvailabilityBody) {
    const p = await this.profileRow(artisan.id);
    if (p.status !== 'approved') throw forbidden('artisan_not_approved', "Votre profil doit être validé pour recevoir des urgences.");
    if (body.available && p.urgentSuspendedUntil && p.urgentSuspendedUntil > new Date()) {
      throw forbidden('urgent_suspended', `Urgences suspendues jusqu'au ${p.urgentSuspendedUntil.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.`);
    }
    await this.conn.db
      .update(artisanProfiles)
      .set({
        urgentAvailable: body.available,
        ...(body.lat != null && body.lng != null ? { currentLat: body.lat, currentLng: body.lng, currentLocationAt: new Date() } : {}),
      })
      .where(eq(artisanProfiles.id, p.id));
    return this.profile(p.id);
  }

  /* ------------------------- Tableau de bord ------------------------- */

  async dashboard(artisan: { id: string; userId: string }): Promise<ArtisanDashboardDto> {
    const p = await this.profileRow(artisan.id);
    const viewer = { userId: artisan.userId, actor: 'artisan' as const, artisanId: artisan.id };
    const start = parisStartOfDay(new Date());
    const end = parisToUtc(addDays(parisDate(new Date()), 1), '00:00');
    const db = this.conn.db;
    const todayRows = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.artisanId, artisan.id),
          notInArray(bookings.status, ['pending_payment', 'requested']),
          sql`coalesce(${bookings.scheduledAt}, ${bookings.acceptedAt}, ${bookings.createdAt}) >= ${start.toISOString()}::timestamptz and coalesce(${bookings.scheduledAt}, ${bookings.acceptedAt}, ${bookings.createdAt}) < ${end.toISOString()}::timestamptz`,
        ),
      );
    const closedToday = await db
      .select({ captured: bookings.capturedCents, commission: bookings.commissionCents })
      .from(bookings)
      .where(and(eq(bookings.artisanId, artisan.id), eq(bookings.status, 'closed'), gte(bookings.closedAt, start), lt(bookings.closedAt, end)));
    const upcoming = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.artisanId, artisan.id), inArray(bookings.status, ACTIVE_BOOKING_STATUSES.filter((st) => st !== 'requested'))))
      .orderBy(sql`coalesce(${bookings.scheduledAt}, ${bookings.acceptedAt}) asc nulls last`)
      .limit(6);
    const requests = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.artisanId, artisan.id), eq(bookings.status, 'requested')))
      .orderBy(asc(bookings.scheduledAt))
      .limit(20);
    const summaries = await this.mapper.toSummaries(upcoming, viewer);
    return {
      today: {
        count: todayRows.length,
        earningsCents: closedToday.reduce((s, r) => s + (r.captured ?? 0) - (r.commission ?? 0), 0),
        completed: closedToday.length,
      },
      next: summaries[0] ?? null,
      pendingOffers: p.status === 'approved' ? await this.dispatch.pendingOffers(artisan.id) : [],
      pendingRequests: await this.mapper.toSummaries(requests, viewer),
      upcoming: summaries.slice(1),
      urgentAvailable: p.urgentAvailable,
      status: p.status,
    };
  }

  async planning(artisan: { id: string; userId: string }, from: Date, to: Date): Promise<PlanningDto> {
    if (to <= from) throw badRequest('invalid_range', 'Période invalide.');
    if (to.getTime() - from.getTime() > 93 * 86_400_000) throw badRequest('range_too_large', 'Période limitée à 3 mois.');
    const db = this.conn.db;
    const rows = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.artisanId, artisan.id),
          // Demandes en attente incluses ; paiements en attente seulement s'il les a proposés (prix, report).
          or(ne(bookings.status, 'pending_payment'), isNotNull(bookings.artisanAcceptedAt)),
          sql`coalesce(${bookings.scheduledAt}, ${bookings.acceptedAt}, ${bookings.createdAt}) >= ${from.toISOString()}::timestamptz and coalesce(${bookings.scheduledAt}, ${bookings.acceptedAt}, ${bookings.createdAt}) < ${to.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(sql`coalesce(${bookings.scheduledAt}, ${bookings.acceptedAt}, ${bookings.createdAt})`);
    const exceptions = await db
      .select()
      .from(availabilityExceptions)
      .where(and(eq(availabilityExceptions.artisanId, artisan.id), lt(availabilityExceptions.startsAt, to), gt(availabilityExceptions.endsAt, from)));
    const rules = await db.select().from(availabilityRules).where(eq(availabilityRules.artisanId, artisan.id)).orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));
    return {
      bookings: await this.mapper.toSummaries(rows, { userId: artisan.userId, actor: 'artisan', artisanId: artisan.id }),
      exceptions: exceptions.map(this.toExceptionDto),
      rules: rules.map((r) => ({ weekday: r.weekday, start: r.startTime, end: r.endTime })),
    };
  }

  async earnings(artisan: { id: string }): Promise<EarningsDto> {
    const p = await this.profileRow(artisan.id);
    const rows = await this.conn.db
      .select()
      .from(bookings)
      .where(and(eq(bookings.artisanId, artisan.id), isNotNull(bookings.capturedCents), gt(bookings.capturedCents, 0)))
      .orderBy(desc(sql`coalesce(${bookings.closedAt}, ${bookings.cancelledAt}, ${bookings.updatedAt})`))
      .limit(500);
    const lines = rows.map((b) => {
      const gross = b.capturedCents ?? 0;
      const commission = b.commissionCents ?? 0;
      return {
        bookingId: b.id,
        reference: b.reference,
        date: (b.closedAt ?? b.cancelledAt ?? b.updatedAt).toISOString(),
        grossCents: gross,
        commissionCents: commission,
        netCents: gross - commission,
      };
    });
    const lifetimeCents = lines.reduce((s, l) => s + l.netCents, 0);
    let availableCents = 0;
    let pendingCents = 0;
    let payouts: EarningsDto['payouts'] = [];
    const balance = p.stripeAccountId ? await this.payments.provider.getBalance(p.stripeAccountId).catch(() => null) : null;
    if (balance) {
      availableCents = balance.availableCents;
      pendingCents = balance.pendingCents;
      payouts = await this.payments.provider.listPayouts(p.stripeAccountId!).catch(() => []);
    } else {
      // Estimation hors Stripe : délai de mise à disposition de 7 jours.
      const cutoff = Date.now() - 7 * 86_400_000;
      for (const l of lines) (new Date(l.date).getTime() > cutoff ? (pendingCents += l.netCents) : (availableCents += l.netCents));
    }
    return { availableCents, pendingCents, lifetimeCents, commissionLifetimeCents: lines.reduce((s, l) => s + l.commissionCents, 0), payouts, lines: lines.slice(0, 100) };
  }

  async stats(artisan: { id: string }): Promise<ArtisanStatsDto> {
    const p = await this.profileRow(artisan.id);
    const monthly = await this.conn.db.execute<{ month: string; revenue: number; count: number }>(sql`
      select to_char(date_trunc('month', closed_at at time zone 'Europe/Paris'), 'YYYY-MM') as month,
             coalesce(sum(coalesce(captured_cents, 0) - coalesce(commission_cents, 0)), 0)::int as revenue, count(*)::int as count
      from bookings
      where artisan_id = ${artisan.id} and status = 'closed' and closed_at >= now() - interval '12 months'
      group by 1 order by 1`);
    return {
      monthly: monthly.map((m) => ({ month: m.month, revenueCents: Number(m.revenue), count: Number(m.count) })),
      acceptanceRate: p.offersReceived > 0 ? Math.round((p.offersAccepted / p.offersReceived) * 100) / 100 : null,
      ratingAvg: p.ratingAvg != null ? Math.round(p.ratingAvg * 10) / 10 : null,
      ratingCount: p.ratingCount,
      cancellations30d: await this.reliability.cancellations30d(artisan.id),
      completedCount: p.completedCount,
    };
  }
}
