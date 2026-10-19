import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  RULES,
  computePrice,
  type AddressSuggestion,
  type ArtisanCardDto,
  type ArtisanPublicDto,
  type ArtisanSearchQuery,
  type DomainCode,
  type DomainDto,
  type EstimateBody,
  type EstimateDto,
  type Paginated,
  type QualificationBadge,
  type ServiceDto,
} from '@depano/schemas';
import { and, artisanProfiles, artisanServices, asc, domains, eq, services, sql } from '@depano/db';
import type { SQL } from 'drizzle-orm';
import { DbConnection } from '../../infra/db';
import { AppConfig } from '../../config/config.service';
import { FilesService } from '../files/files.service';
import { SlotsService } from './slots.service';
import { ReviewsService } from './reviews.service';
import { notFound } from '../../common/errors';
import { decodeOffset, paginate } from '../../common/pagination';
import { naiveEtaMinutes, parisParts } from '../../common/time';

export const toServiceDto = (s: typeof services.$inferSelect): ServiceDto => ({
  id: s.id,
  domain: s.domain as DomainCode,
  slug: s.slug,
  name: s.name,
  description: s.description,
  kind: s.kind,
  urgentEligible: s.urgentEligible,
  referencePriceCents: s.referencePriceCents,
  defaultDurationMinutes: s.defaultDurationMinutes,
});

interface CardRow extends Record<string, unknown> {
  id: string;
  display_name: string;
  company_name: string | null;
  domains: string[] | string;
  rating_avg: number | null;
  rating_count: number;
  urgent_available: boolean;
  urgent_suspended_until: Date | null;
  siret: string | null;
  company_active: boolean | null;
  qualifications: string[] | string;
  avatar_file_id: string | null;
  from_price: number | null;
  distance_km: number | null;
  insured: boolean;
}

/** postgres.js renvoie les tableaux d'enum sous forme de littéral « {a,b} ». */
const pgArray = (v: string[] | string | null): string[] =>
  Array.isArray(v) ? v : typeof v === 'string' ? v.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map((x) => x.replace(/^"|"$/g, '')) : [];

const point = (lat: number, lng: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

@Injectable()
export class CatalogService {
  private readonly logger = new Logger('Catalog');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(SlotsService) private readonly slots: SlotsService,
    @Inject(ReviewsService) private readonly reviewsService: ReviewsService,
  ) {}

  async domains(): Promise<DomainDto[]> {
    const [ds, ss] = await Promise.all([
      this.conn.db.select().from(domains).orderBy(asc(domains.sortOrder)),
      this.conn.db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder), asc(services.name)),
    ]);
    return ds.map((d) => ({
      code: d.code as DomainCode,
      name: d.name,
      icon: d.icon,
      services: ss.filter((s) => s.domain === d.code).map(toServiceDto),
    }));
  }

  private cardSelect(opts: { lat?: number; lng?: number; domain?: DomainCode }) {
    const hasPoint = opts.lat != null && opts.lng != null;
    return sql`
      select a.id, a.display_name, a.company_name, a.domains, a.rating_avg, a.rating_count, a.urgent_available,
        a.urgent_suspended_until, a.siret, a.company_active, a.qualifications, u.avatar_file_id, a.created_at,
        (select min(s.price_cents) from artisan_services s join services sv on sv.id = s.service_id
           where s.artisan_id = a.id and sv.active ${opts.domain ? sql`and sv.domain = ${opts.domain}::domain_code` : sql``})::int as from_price,
        ${hasPoint ? sql`(ST_Distance(a.base_location, ${point(opts.lat!, opts.lng!)}) / 1000.0)::float8` : sql`null::float8`} as distance_km,
        exists (select 1 from artisan_documents d where d.artisan_id = a.id and d.status = 'approved'
          and d.type in ('insurance_decennale', 'insurance_rc_pro') and (d.expires_at is null or d.expires_at >= current_date)) as insured
      from artisan_profiles a join users u on u.id = a.user_id
      where a.status = 'approved' and u.deleted_at is null`;
  }

  private async toCards(rows: CardRow[]): Promise<ArtisanCardDto[]> {
    const next = await this.slots.nextSlots(rows.map((r) => r.id));
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        displayName: r.display_name,
        companyName: r.company_name ?? r.display_name,
        avatarUrl: await this.filesService.signedUrl(r.avatar_file_id),
        domains: pgArray(r.domains) as DomainCode[],
        ratingAvg: r.rating_avg != null ? Math.round(Number(r.rating_avg) * 10) / 10 : null,
        ratingCount: Number(r.rating_count),
        distanceKm: r.distance_km != null ? Math.round(Number(r.distance_km) * 10) / 10 : null,
        fromPriceCents: r.from_price != null ? Number(r.from_price) : null,
        urgentAvailable: !!r.urgent_available && (!r.urgent_suspended_until || new Date(r.urgent_suspended_until) < new Date()),
        nextSlotAt: next.get(r.id) ?? null,
        badges: {
          siretVerified: !!r.siret && r.company_active === true,
          insured: !!r.insured,
          qualifications: pgArray(r.qualifications) as QualificationBadge[],
        },
      })),
    );
  }

  async cardsByIds(ids: string[]): Promise<ArtisanCardDto[]> {
    if (!ids.length) return [];
    const rows = await this.conn.db.execute<CardRow>(sql`${this.cardSelect({})} and a.id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return this.toCards(ids.map((id) => byId.get(id)).filter((r): r is CardRow => !!r));
  }

  async search(q: ArtisanSearchQuery): Promise<Paginated<ArtisanCardDto>> {
    const offset = decodeOffset(q.cursor);
    const hasPoint = q.lat != null && q.lng != null;
    const conds: SQL[] = [];
    if (q.domain) conds.push(sql`${q.domain}::domain_code = any(a.domains)`);
    if (q.q?.trim()) {
      const like = `%${q.q.trim().replace(/[%_]/g, '')}%`;
      conds.push(sql`(a.display_name ilike ${like} or a.company_name ilike ${like} or a.bio ilike ${like}
        or exists (select 1 from artisan_services s join services sv on sv.id = s.service_id where s.artisan_id = a.id and sv.name ilike ${like}))`);
    }
    if (hasPoint) conds.push(sql`ST_DWithin(a.base_location, ${point(q.lat!, q.lng!)}, ${q.radiusKm * 1000})`);
    if (q.minRating != null) conds.push(sql`coalesce(a.rating_avg, 0) >= ${q.minRating}`);
    if (q.availableToday) {
      const p = parisParts(new Date());
      conds.push(sql`((a.urgent_available and (a.urgent_suspended_until is null or a.urgent_suspended_until < now()))
        or exists (select 1 from availability_rules r where r.artisan_id = a.id and r.weekday = ${p.weekday} and r.end_time > ${p.time}))`);
    }
    const inner = sql`${this.cardSelect({ lat: q.lat, lng: q.lng, domain: q.domain })} ${conds.length ? sql`and ${sql.join(conds, sql` and `)}` : sql``}`;
    const order =
      q.sort === 'distance' && hasPoint
        ? sql`distance_km asc nulls last`
        : q.sort === 'rating'
          ? sql`rating_avg desc nulls last, rating_count desc`
          : q.sort === 'price'
            ? sql`from_price asc nulls last`
            : sql`(coalesce(rating_avg, 4) * 2 - coalesce(distance_km, 0) * 0.3 + case when urgent_available then 0.5 else 0 end + least(rating_count, 200) / 100.0) desc`;
    const rows = await this.conn.db.execute<CardRow>(sql`
      select * from (${inner}) t
      where ${q.maxPriceCents != null ? sql`t.from_price <= ${q.maxPriceCents}` : sql`true`}
      order by ${order}, t.id
      limit ${q.limit + 1} offset ${offset}`);
    const page = paginate([...rows], offset, q.limit);
    return { items: await this.toCards(page.items), nextCursor: page.nextCursor };
  }

  async assertApproved(id: string) {
    const [a] = await this.conn.db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(and(eq(artisanProfiles.id, id), eq(artisanProfiles.status, 'approved')));
    if (!a) throw notFound('artisan_not_found', 'Artisan introuvable.');
  }

  async publicProfile(id: string, near?: { lat?: number; lng?: number }): Promise<ArtisanPublicDto> {
    const rows = await this.conn.db.execute<CardRow>(sql`${this.cardSelect({ lat: near?.lat, lng: near?.lng })} and a.id = ${id}::uuid`);
    const row = rows[0];
    if (!row) throw notFound('artisan_not_found', 'Artisan introuvable.');
    const [card] = await this.toCards([row]);
    const [p] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.id, id));
    const svc = await this.conn.db
      .select({ serviceId: services.id, name: services.name, domain: services.domain, priceCents: artisanServices.priceCents, durationMinutes: artisanServices.durationMinutes })
      .from(artisanServices)
      .innerJoin(services, eq(services.id, artisanServices.serviceId))
      .where(and(eq(artisanServices.artisanId, id), eq(services.active, true)))
      .orderBy(asc(services.domain), asc(services.sortOrder));
    return {
      ...card!,
      bio: p!.bio,
      city: p!.baseCity,
      radiusKm: p!.radiusKm,
      travelFeeCents: p!.travelFeeCents,
      services: svc.map((s) => ({ ...s, domain: s.domain as DomainCode })),
      portfolioUrls: await this.filesService.signedUrls(p!.portfolioFileIds),
      recentReviews: await this.reviewsService.recent(id, 5),
      memberSince: (p!.approvedAt ?? p!.createdAt).toISOString(),
      completedCount: p!.completedCount,
      acceptanceRate: p!.offersReceived > 0 ? Math.round((p!.offersAccepted / p!.offersReceived) * 100) / 100 : null,
    };
  }

  async estimate(body: EstimateBody): Promise<EstimateDto> {
    const db = this.conn.db;
    let basePriceCents = 0;
    let travelFeeCents = 2500;
    if (body.artisanId) {
      const [a] = await db.select().from(artisanProfiles).where(eq(artisanProfiles.id, body.artisanId));
      if (a) travelFeeCents = a.travelFeeCents;
    }
    if (body.serviceId && body.artisanId) {
      const [as] = await db
        .select({ p: artisanServices.priceCents })
        .from(artisanServices)
        .where(and(eq(artisanServices.artisanId, body.artisanId), eq(artisanServices.serviceId, body.serviceId)));
      if (as) basePriceCents = as.p;
    }
    if (!basePriceCents && body.serviceId) {
      const [s] = await db.select().from(services).where(eq(services.id, body.serviceId));
      if (s) basePriceCents = s.referencePriceCents;
    }
    if (!basePriceCents) {
      const [r] = await db
        .select({ p: sql<number>`min(${services.referencePriceCents})::int` })
        .from(services)
        .where(and(eq(services.domain, body.domain), eq(services.active, true), body.urgent ? eq(services.urgentEligible, true) : undefined));
      basePriceCents = r?.p ?? 0;
    }
    const price = computePrice({ basePriceCents, travelFeeCents, urgent: body.urgent, withGuarantee: body.withGuarantee });
    if (body.lat == null || body.lng == null) return { price, availableArtisans: 0, inZone: false, etaMinutes: null };
    const pt = point(body.lat, body.lng);
    const [zone] = await db.execute<{ n: number }>(sql`select count(*)::int as n from zones z where z.active and ST_DWithin(z.center, ${pt}, z.radius_km * 1000)`);
    let availableArtisans = 0;
    let etaMinutes: number | null = null;
    if (body.urgent) {
      const maxRadius = RULES.dispatch.radiiKm[RULES.dispatch.radiiKm.length - 1]!;
      const [r] = await db.execute<{ n: number; d: number | null }>(sql`
        select count(*)::int as n, min(distance_km)::float8 as d
        from find_dispatch_candidates(gen_random_uuid(), ${body.domain}::domain_code, ${body.lat}, ${body.lng}, ${maxRadius}, 100)`);
      availableArtisans = Number(r?.n ?? 0);
      etaMinutes = r?.d != null ? naiveEtaMinutes(Number(r.d)) + 5 : null;
    } else {
      const [r] = await db.execute<{ n: number }>(sql`
        select count(*)::int as n from artisan_profiles a
        where a.status = 'approved' and ${body.domain}::domain_code = any(a.domains)
          and ST_DWithin(a.base_location, ${pt}, a.radius_km * 1000)`);
      availableArtisans = Number(r?.n ?? 0);
    }
    return { price, availableArtisans, inZone: Number(zone?.n ?? 0) > 0, etaMinutes };
  }

  /* ---------------------- Géocodage (API Adresse) ---------------------- */

  private async adresse(path: string, params: Record<string, string>): Promise<AddressSuggestion[]> {
    if (this.config.env.OFFLINE_MODE) return [];
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr${path}?${new URLSearchParams(params)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        features?: { geometry: { coordinates: [number, number] }; properties: { label: string; name: string; postcode: string; city: string } }[];
      };
      return (json.features ?? []).map((f) => ({
        label: f.properties.label,
        line1: f.properties.name,
        postalCode: f.properties.postcode,
        city: f.properties.city,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
    } catch (e) {
      this.logger.warn(`API Adresse indisponible : ${e}`);
      return [];
    }
  }

  async searchAddress(q: string, near?: { lat?: number; lng?: number }) {
    if (!q || q.trim().length < 3) return [];
    return this.adresse('/search/', {
      q: q.trim().slice(0, 200),
      limit: '6',
      autocomplete: '1',
      ...(near?.lat != null && near?.lng != null ? { lat: String(near.lat), lon: String(near.lng) } : {}),
    });
  }

  async reverse(lat: number, lng: number) {
    return (await this.adresse('/reverse/', { lat: String(lat), lon: String(lng), limit: '1' }))[0] ?? null;
  }
}
