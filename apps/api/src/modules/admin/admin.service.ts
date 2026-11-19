import { Inject, Injectable } from '@nestjs/common';
import {
  type AdminArtisanDetailDto,
  type AdminArtisanRowDto,
  type AdminBookingDetailDto,
  type AdminDisputeRowDto,
  type AdminMetricsDto,
  type AdminServiceBody,
  type AdminUserRowDto,
  type ArtisanStatus,
  type BookingSummaryDto,
  type DisputeDto,
  type DomainCode,
  type Paginated,
  type ResolveDisputeBody,
  type Role,
  type ServiceDto,
  type ZoneBody,
  type ZoneDto,
} from '@depano/schemas';
import { z } from 'zod';
import {
  AdminArtisanListQuery,
  AdminBookingListQuery,
} from '@depano/schemas';
import {
  and,
  artisanDocuments,
  artisanProfiles,
  bookingLocations,
  bookings,
  desc,
  disputes,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  services,
  sql,
  users,
  zones,
  asc,
} from '@depano/db';
import { DbConnection } from '../../infra/db';
import { StorageService } from '../../infra/storage';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingMapper, toDisputeDto } from '../bookings/booking-mapper.service';
import { BookingsService } from '../bookings/bookings.service';
import { BookingStateService } from '../bookings/booking-state.service';
import { PaymentsService } from '../payments/payments.service';
import { ChatService } from '../chat/chat.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { ArtisanService } from '../artisan/artisan.service';
import { ReliabilityService } from '../maintenance/reliability.service';
import { toServiceDto } from '../catalog/catalog.service';
import { AuditService } from './audit.service';
import type { AuthUser } from '../../common/auth';
import { badRequest, conflict, notFound } from '../../common/errors';
import { decodeOffset, paginate } from '../../common/pagination';
import { days } from '../../common/time';

const toZoneDto = (z: typeof zones.$inferSelect): ZoneDto => ({
  id: z.id,
  name: z.name,
  centerLat: z.centerLat,
  centerLng: z.centerLng,
  radiusKm: z.radiusKm,
  commissionRate: z.commissionRate,
  active: z.active,
});

const ratio = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 10_000) / 10_000 : null);

@Injectable()
export class AdminService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(BookingMapper) private readonly mapper: BookingMapper,
    @Inject(BookingsService) private readonly bookingsService: BookingsService,
    @Inject(BookingStateService) private readonly state: BookingStateService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(ArtisanService) private readonly artisans: ArtisanService,
    @Inject(ReliabilityService) private readonly reliability: ReliabilityService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /* ----------------------------- Indicateurs ----------------------------- */

  async metrics(from?: string, to?: string): Promise<AdminMetricsDto> {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - days(30));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw badRequest('invalid_range', 'Période invalide.');
    const db = this.conn.db;
    const [k] = await db.execute<Record<string, number | null>>(sql`
      with b as (select * from bookings where created_at >= ${start.toISOString()}::timestamptz and created_at < ${end.toISOString()}::timestamptz)
      select
        (select count(*) from b where kind = 'urgent' and dispatch_started_at is not null)::int as urgent_sent,
        (select count(*) from b where kind = 'urgent' and dispatch_started_at is not null and accepted_at is not null)::int as urgent_taken,
        (select percentile_cont(0.5) within group (order by extract(epoch from accepted_at - dispatch_started_at))
           from b where kind = 'urgent' and accepted_at is not null and dispatch_started_at is not null)::float8 as median_accept,
        (select count(*) from b where kind = 'urgent')::int as urgent_created,
        (select count(*) from b where kind = 'urgent' and status <> 'pending_payment' and not (status = 'cancelled_by_client' and dispatch_started_at is null))::int as urgent_authorized,
        (select count(*) from b where status = 'closed')::int as closed,
        (select count(*) from b where status = 'closed' and exists (
           select 1 from booking_events e where e.booking_id = b.id and e.to_status = 'closed' and e.actor = 'artisan'))::int as closed_by_code,
        (select count(*) from b where status <> 'pending_payment')::int as real_bookings,
        (select count(*) from disputes d join b on b.id = d.booking_id)::int as disputes,
        (select count(*) from b)::int as bookings,
        (select coalesce(sum(captured_cents), 0) from b)::bigint as gmv,
        (select coalesce(sum(commission_cents), 0) from b)::bigint as commission,
        (select avg(rating) from reviews where created_at >= ${start.toISOString()}::timestamptz and created_at < ${end.toISOString()}::timestamptz)::float8 as rating_avg,
        (select count(distinct client_id) from b where status = 'closed')::int as clients,
        (select count(*) from (select b1.client_id from b b1 where b1.status = 'closed' and exists (
           select 1 from bookings b2 where b2.client_id = b1.client_id and b2.status = 'closed' and b2.id <> b1.id
             and b2.created_at between b1.created_at - interval '6 months' and b1.created_at + interval '6 months')
           group by b1.client_id) r)::int as recurring,
        (select count(distinct artisan_id) from b where status = 'closed')::int as active_artisans_period,
        (select count(*) from artisan_profiles where status = 'approved')::int as active_artisans,
        (select count(*) from artisan_profiles where status = 'pending_review')::int as pending_artisans,
        (select count(*) from disputes where status = 'open')::int as open_disputes`);
    const n = (key: string) => Number(k?.[key] ?? 0);
    const weeks = Math.max(1, (end.getTime() - start.getTime()) / days(7));
    const daily = await db.execute<{ date: string; bookings: number; gmv: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as date,
        (select count(*) from bookings b where (b.created_at at time zone 'Europe/Paris')::date = d)::int as bookings,
        (select coalesce(sum(captured_cents), 0) from bookings b where (b.created_at at time zone 'Europe/Paris')::date = d)::bigint as gmv
      from generate_series((${start.toISOString()}::timestamptz at time zone 'Europe/Paris')::date, (${end.toISOString()}::timestamptz at time zone 'Europe/Paris')::date, interval '1 day') d`);
    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      urgentTakeRate: ratio(n('urgent_taken'), n('urgent_sent')),
      medianAcceptanceSeconds: k?.median_accept != null ? Math.round(Number(k.median_accept)) : null,
      urgentFunnelConversion: ratio(n('urgent_authorized'), n('urgent_created')),
      codeClosureRate: ratio(n('closed_by_code'), n('closed')),
      disputeRate: ratio(n('disputes'), n('real_bookings')),
      ratingAvg: k?.rating_avg != null ? Math.round(Number(k.rating_avg) * 100) / 100 : null,
      clientRecurrence: ratio(n('recurring'), n('clients')),
      bookingsPerActiveArtisanWeek: n('active_artisans_period') > 0 ? Math.round((n('closed') / n('active_artisans_period') / weeks) * 100) / 100 : null,
      totals: {
        bookings: n('bookings'),
        closed: n('closed'),
        gmvCents: n('gmv'),
        commissionCents: n('commission'),
        activeArtisans: n('active_artisans'),
        pendingArtisans: n('pending_artisans'),
        openDisputes: n('open_disputes'),
      },
      daily: daily.map((d) => ({ date: d.date, bookings: Number(d.bookings), gmvCents: Number(d.gmv) })),
    };
  }

  /* ------------------------------- Artisans ------------------------------ */

  async artisansList(q: z.output<typeof AdminArtisanListQuery>): Promise<Paginated<AdminArtisanRowDto>> {
    const offset = decodeOffset(q.cursor);
    const like = q.q ? `%${q.q.replace(/[%_]/g, '')}%` : null;
    const rows = await this.conn.db
      .select({ a: artisanProfiles, phone: users.phone })
      .from(artisanProfiles)
      .innerJoin(users, eq(users.id, artisanProfiles.userId))
      .where(
        and(
          q.status ? eq(artisanProfiles.status, q.status) : undefined,
          like
            ? or(ilike(artisanProfiles.displayName, like), ilike(artisanProfiles.companyName, like), ilike(artisanProfiles.siret, like), ilike(users.phone, like))
            : undefined,
        ),
      )
      .orderBy(sql`case when ${artisanProfiles.status} = 'pending_review' then 0 else 1 end`, desc(artisanProfiles.submittedAt), desc(artisanProfiles.createdAt))
      .limit(q.limit + 1)
      .offset(offset);
    const page = paginate(rows, offset, q.limit);
    return {
      items: page.items.map(({ a, phone }) => ({
        id: a.id,
        userId: a.userId,
        displayName: a.displayName,
        companyName: a.companyName,
        siret: a.siret,
        phone,
        status: a.status as ArtisanStatus,
        domains: a.domains as DomainCode[],
        city: a.baseCity,
        ratingAvg: a.ratingAvg,
        completedCount: a.completedCount,
        submittedAt: a.submittedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  async artisanDetail(id: string, viewerId: string): Promise<AdminArtisanDetailDto> {
    const p = await this.artisans.profileRow(id);
    const [u] = await this.conn.db.select().from(users).where(eq(users.id, p.userId));
    const recent = await this.conn.db.select().from(bookings).where(eq(bookings.artisanId, id)).orderBy(desc(bookings.createdAt)).limit(10);
    return {
      ...(await this.artisans.toPrivate(p)),
      userId: p.userId,
      phone: u?.phone ?? null,
      email: u?.email ?? null,
      companyActive: p.companyActive,
      cancellations30d: await this.reliability.cancellations30d(id),
      recentBookings: await this.mapper.toSummaries(recent, { userId: viewerId, actor: 'support' }),
    };
  }

  async approveArtisan(admin: AuthUser, id: string) {
    const p = await this.artisans.profileRow(id);
    if (p.status === 'approved') return this.artisanDetail(id, admin.id);
    const docs = await this.conn.db.select().from(artisanDocuments).where(eq(artisanDocuments.artisanId, id));
    const ok = (types: string[]) => docs.some((d) => types.includes(d.type) && !['rejected', 'expired'].includes(d.status));
    if (!ok(['identity']) || !ok(['insurance_decennale', 'insurance_rc_pro'])) {
      throw conflict('documents_missing', "Pièce d'identité et attestation d'assurance (non rejetées) requises avant validation.");
    }
    await this.conn.db
      .update(artisanProfiles)
      .set({ status: 'approved', approvedAt: new Date(), approvedBy: admin.id, rejectionReason: null })
      .where(eq(artisanProfiles.id, id));
    await this.audit.log(admin.id, 'artisan.approve', 'artisan_profile', id, { previousStatus: p.status });
    await this.notifications.notify(p.userId, {
      type: 'artisan_approved',
      title: 'Profil validé 🎉',
      body: 'Votre profil est vérifié : activez la disponibilité pour recevoir vos premières demandes.',
      link: 'depano://artisan/espace',
      data: { artisanId: id },
    });
    return this.artisanDetail(id, admin.id);
  }

  async rejectArtisan(admin: AuthUser, id: string, reason?: string) {
    const p = await this.artisans.profileRow(id);
    await this.conn.db.update(artisanProfiles).set({ status: 'rejected', rejectionReason: reason ?? null, urgentAvailable: false }).where(eq(artisanProfiles.id, id));
    await this.audit.log(admin.id, 'artisan.reject', 'artisan_profile', id, { previousStatus: p.status, reason });
    await this.notifications.notify(p.userId, {
      type: 'artisan_rejected',
      title: 'Dossier à compléter',
      body: reason ? `Votre dossier n'a pas pu être validé : ${reason}` : "Votre dossier n'a pas pu être validé. Consultez les détails dans l'app.",
      link: 'depano://artisan/kyc',
      data: { artisanId: id },
    });
    return this.artisanDetail(id, admin.id);
  }

  async suspendArtisan(admin: AuthUser, id: string, reason?: string) {
    const p = await this.artisans.profileRow(id);
    await this.conn.db.update(artisanProfiles).set({ status: 'suspended', urgentAvailable: false, rejectionReason: reason ?? null }).where(eq(artisanProfiles.id, id));
    await this.audit.log(admin.id, 'artisan.suspend', 'artisan_profile', id, { previousStatus: p.status, reason });
    await this.notifications.notify(p.userId, {
      type: 'booking_status',
      title: 'Compte artisan suspendu',
      body: reason ? `Votre compte est suspendu : ${reason}` : 'Votre compte artisan est suspendu. Contactez le support.',
      data: { artisanId: id },
    });
    return this.artisanDetail(id, admin.id);
  }

  async reinstateArtisan(admin: AuthUser, id: string) {
    const p = await this.artisans.profileRow(id);
    if (p.status !== 'suspended') throw conflict('not_suspended', "Ce compte n'est pas suspendu.");
    await this.conn.db.update(artisanProfiles).set({ status: 'approved', rejectionReason: null, urgentSuspendedUntil: null }).where(eq(artisanProfiles.id, id));
    await this.audit.log(admin.id, 'artisan.reinstate', 'artisan_profile', id, {});
    await this.notifications.notify(p.userId, { type: 'artisan_approved', title: 'Compte réactivé', body: 'Votre compte artisan est de nouveau actif.', data: { artisanId: id } });
    return this.artisanDetail(id, admin.id);
  }

  async reviewDocument(admin: AuthUser, id: string, approve: boolean, reason?: string) {
    const [d] = await this.conn.db.select().from(artisanDocuments).where(eq(artisanDocuments.id, id));
    if (!d) throw notFound('document_not_found', 'Document introuvable.');
    const [updated] = await this.conn.db
      .update(artisanDocuments)
      .set({ status: approve ? 'approved' : 'rejected', rejectionReason: approve ? null : (reason ?? null), reviewedBy: admin.id, reviewedAt: new Date() })
      .where(eq(artisanDocuments.id, id))
      .returning();
    await this.audit.log(admin.id, approve ? 'document.approve' : 'document.reject', 'artisan_document', id, { reason, type: d.type });
    if (!approve) {
      const p = await this.artisans.profileRow(d.artisanId);
      await this.notifications.notify(p.userId, {
        type: 'artisan_rejected',
        title: 'Document refusé',
        body: reason ? `Un document a été refusé : ${reason}` : 'Un de vos documents a été refusé, merci de le renvoyer.',
        link: 'depano://artisan/kyc',
        data: { documentId: id },
      });
    }
    return this.artisans.toDocumentDto(updated!);
  }

  /* ----------------------------- Interventions --------------------------- */

  async bookingsList(q: z.output<typeof AdminBookingListQuery>, viewerId: string): Promise<Paginated<BookingSummaryDto>> {
    const offset = decodeOffset(q.cursor);
    const like = q.q ? `%${q.q.replace(/[%_]/g, '')}%` : null;
    const rows = await this.conn.db
      .select({ b: bookings })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.clientId))
      .where(
        and(
          q.status ? eq(bookings.status, q.status) : undefined,
          q.kind ? eq(bookings.kind, q.kind) : undefined,
          like ? or(ilike(bookings.reference, like), ilike(users.phone, like), ilike(bookings.problemReason, like)) : undefined,
        ),
      )
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(q.limit + 1)
      .offset(offset);
    const page = paginate(
      rows.map((r) => r.b),
      offset,
      q.limit,
    );
    return { items: await this.mapper.toSummaries(page.items, { userId: viewerId, actor: 'support' }), nextCursor: page.nextCursor };
  }

  async bookingDetail(id: string, viewerId: string): Promise<AdminBookingDetailDto> {
    const b = await this.bookingsService.load(id);
    const detail = await this.mapper.toDetail(b, { userId: viewerId, actor: 'support' });
    const [client] = await this.conn.db.select({ phone: users.phone }).from(users).where(eq(users.id, b.clientId));
    const [artisan] = b.artisanId
      ? await this.conn.db.select({ phone: users.phone }).from(artisanProfiles).innerJoin(users, eq(users.id, artisanProfiles.userId)).where(eq(artisanProfiles.id, b.artisanId))
      : [];
    const locations = await this.conn.db.select().from(bookingLocations).where(eq(bookingLocations.bookingId, id)).orderBy(asc(bookingLocations.createdAt));
    const pays = await this.payments.listForBooking(id);
    const offers = await this.dispatch.offersForAdmin(id);
    return {
      ...detail,
      clientPhone: client?.phone ?? null,
      artisanPhone: artisan?.phone ?? null,
      locations: locations.map((l) => ({ lat: l.lat, lng: l.lng, at: l.createdAt.toISOString() })),
      messages: await this.chat.messagesForBooking(id),
      payments: pays.map((p) => ({
        id: p.id,
        provider: p.provider,
        providerRef: p.providerRef,
        status: p.status,
        amountCents: p.amountCents,
        capturedCents: p.capturedCents,
        createdAt: p.createdAt.toISOString(),
      })),
      dispatchOffers: offers.map(({ o, name }) => ({
        artisanId: o.artisanId,
        artisanName: name,
        wave: o.wave,
        status: o.status,
        distanceKm: Math.round(o.distanceKm * 10) / 10,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  }

  /* -------------------------------- Litiges ------------------------------ */

  async disputesList(status?: 'open' | 'resolved'): Promise<AdminDisputeRowDto[]> {
    const rows = await this.conn.db
      .select({ d: disputes, b: bookings, clientFirst: users.firstName, clientLast: users.lastName, artisanName: artisanProfiles.displayName })
      .from(disputes)
      .innerJoin(bookings, eq(bookings.id, disputes.bookingId))
      .innerJoin(users, eq(users.id, bookings.clientId))
      .leftJoin(artisanProfiles, eq(artisanProfiles.id, bookings.artisanId))
      .where(status ? eq(disputes.status, status) : undefined)
      .orderBy(asc(disputes.dueAt))
      .limit(500);
    return rows.map(({ d, b, clientFirst, clientLast, artisanName }) => ({
      id: d.id,
      bookingId: b.id,
      bookingReference: b.reference,
      reason: d.reason,
      status: d.status,
      clientName: [clientFirst, clientLast].filter(Boolean).join(' ') || 'Client',
      artisanName: artisanName ?? null,
      amountCents: b.authorizedCents || b.totalCents,
      createdAt: d.createdAt.toISOString(),
      dueAt: d.dueAt.toISOString(),
    }));
  }

  /** Arbitrage : capture totale / partielle / frais de déplacement, ou remboursement intégral. */
  async resolveDispute(staff: AuthUser, id: string, body: ResolveDisputeBody): Promise<DisputeDto> {
    const [d] = await this.conn.db.select().from(disputes).where(eq(disputes.id, id));
    if (!d) throw notFound('dispute_not_found', 'Litige introuvable.');
    if (d.status !== 'open') throw conflict('dispute_resolved', 'Ce litige est déjà résolu.');
    const b = await this.bookingsService.load(d.bookingId);
    if (b.status !== 'disputed') throw conflict('invalid_transition', "L'intervention n'est pas en litige.");
    const authorized = (await this.payments.capturable(b.id)).reduce((s, p) => s + p.amountCents, 0);
    let captured = 0;
    let commission = 0;
    if (body.resolution === 'full_refund') {
      await this.state.transition(b.id, 'cancelled_by_artisan', 'support', staff.id, { note: body.note, silent: true });
      await this.payments.releaseAll(b.id);
      await this.conn.db.update(bookings).set({ capturedCents: 0, commissionCents: 0 }).where(eq(bookings.id, b.id));
    } else {
      let amount: number | undefined;
      let travelOnly: boolean | undefined;
      if (body.resolution === 'partial_capture') {
        if (body.captureCents == null) throw badRequest('capture_amount_required', 'Montant à capturer requis pour une capture partielle.');
        if (body.captureCents > authorized) throw badRequest('capture_too_high', 'Le montant dépasse le montant autorisé.', { authorizedCents: authorized });
        amount = body.captureCents;
      } else if (body.resolution === 'travel_fee_only') {
        amount = b.travelFeeCents;
        travelOnly = true;
      }
      const closed = await this.state.transition(b.id, 'closed', 'support', staff.id, { note: body.note, silent: true, patch: travelOnly ? { travelOnly: true } : {} });
      const r = await this.bookingsService.finalizeClosure(closed, { amountCents: amount, travelOnly });
      captured = r.captured;
      commission = r.commission;
    }
    const [updated] = await this.conn.db
      .update(disputes)
      .set({
        status: 'resolved',
        resolution: body.resolution,
        resolutionNote: body.note,
        capturedCents: captured,
        refundedCents: Math.max(0, authorized - captured),
        resolvedBy: staff.id,
        resolvedAt: new Date(),
      })
      .where(eq(disputes.id, id))
      .returning();
    await this.audit.log(staff.id, 'dispute.resolve', 'dispute', id, { resolution: body.resolution, captured, commission, note: body.note, bookingId: b.id });
    const recipients = [b.clientId];
    if (b.artisanId) recipients.push((await this.artisans.profileRow(b.artisanId)).userId);
    await this.notifications.notifyMany(recipients, {
      type: 'booking_status',
      title: 'Litige résolu',
      body: `Décision du support pour ${b.reference} : ${body.note}`,
      link: `depano://intervention/${b.id}`,
      data: { bookingId: b.id, resolution: body.resolution },
    });
    return toDisputeDto(updated!);
  }

  /* ------------------------------- Catalogue ----------------------------- */

  async servicesList() {
    // Catalogue DEPANO : les motifs personnels des artisans sont gérés depuis leur fiche.
    const rows = await this.conn.db.select().from(services).where(isNull(services.ownerArtisanId)).orderBy(asc(services.domain), asc(services.sortOrder));
    return rows.map((s) => ({ ...toServiceDto(s), active: s.active }));
  }

  async createService(admin: AuthUser, body: AdminServiceBody): Promise<ServiceDto> {
    const [s] = await this.conn.db.insert(services).values(body).returning();
    await this.audit.log(admin.id, 'service.create', 'service', s!.id, body);
    return toServiceDto(s!);
  }

  async updateService(admin: AuthUser, id: string, body: Partial<AdminServiceBody>): Promise<ServiceDto> {
    const [s] = await this.conn.db.update(services).set(body).where(and(eq(services.id, id), isNull(services.ownerArtisanId))).returning();
    if (!s) throw notFound('service_not_found', 'Prestation introuvable.');
    await this.audit.log(admin.id, 'service.update', 'service', id, body);
    return toServiceDto(s);
  }

  async zonesList() {
    return (await this.conn.db.select().from(zones).orderBy(asc(zones.name))).map(toZoneDto);
  }

  async createZone(admin: AuthUser, body: ZoneBody) {
    const [z] = await this.conn.db.insert(zones).values(body).returning();
    await this.audit.log(admin.id, 'zone.create', 'zone', z!.id, body);
    return toZoneDto(z!);
  }

  async updateZone(admin: AuthUser, id: string, body: Partial<ZoneBody>) {
    const [z] = await this.conn.db.update(zones).set(body).where(eq(zones.id, id)).returning();
    if (!z) throw notFound('zone_not_found', 'Zone introuvable.');
    await this.audit.log(admin.id, 'zone.update', 'zone', id, body);
    return toZoneDto(z);
  }

  /* ----------------------------- Utilisateurs ---------------------------- */

  async usersList(q?: string, cursor?: string): Promise<Paginated<AdminUserRowDto>> {
    const offset = decodeOffset(cursor);
    const limit = 50;
    const like = q ? `%${q.replace(/[%_]/g, '')}%` : null;
    const rows = await this.conn.db
      .select({
        u: users,
        n: sql<number>`(select count(*) from bookings b where b.client_id = ${users.id})::int`,
      })
      .from(users)
      .where(like ? or(ilike(users.phone, like), ilike(users.email, like), ilike(users.firstName, like), ilike(users.lastName, like)) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit + 1)
      .offset(offset);
    const page = paginate(rows, offset, limit);
    return {
      items: page.items.map(({ u, n }) => ({
        id: u.id,
        phone: u.phone,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roles: u.roles as Role[],
        createdAt: u.createdAt.toISOString(),
        deletedAt: u.deletedAt?.toISOString() ?? null,
        bookingsCount: Number(n),
      })),
      nextCursor: page.nextCursor,
    };
  }

  /* --------------------------------- DAC7 -------------------------------- */

  async dac7Export(admin: AuthUser, year: number) {
    if (!Number.isInteger(year) || year < 2023 || year > 2100) throw badRequest('invalid_year', 'Année invalide.');
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const rows = await this.conn.db.execute<Record<string, string | number | null>>(sql`
      select a.id, a.siret, a.company_name, u.first_name, u.last_name, u.email, a.company_address,
        count(b.id)::int as operations, coalesce(sum(b.captured_cents), 0)::bigint as gross_cents,
        coalesce(sum(b.commission_cents), 0)::bigint as commission_cents,
        ${sql.raw(
          [1, 2, 3, 4]
            .map((qn) => `coalesce(sum(b.captured_cents) filter (where extract(quarter from b.closed_at) = ${qn}), 0)::bigint as q${qn}_cents`)
            .join(', '),
        )}
      from artisan_profiles a join users u on u.id = a.user_id
      join bookings b on b.artisan_id = a.id and b.captured_cents > 0 and coalesce(b.closed_at, b.cancelled_at) >= ${start.toISOString()}::timestamptz and coalesce(b.closed_at, b.cancelled_at) < ${end.toISOString()}::timestamptz
      group by a.id, u.id order by gross_cents desc`);
    const header = ['artisan_id', 'siret', 'raison_sociale', 'prenom', 'nom', 'email', 'adresse', 'nb_operations', 'montant_brut_eur', 'commissions_eur', 'T1_eur', 'T2_eur', 'T3_eur', 'T4_eur'];
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const eur = (c: unknown) => (Number(c ?? 0) / 100).toFixed(2);
    const lines = rows.map((r) =>
      [r.id, r.siret, r.company_name, r.first_name, r.last_name, r.email, r.company_address, r.operations, eur(r.gross_cents), eur(r.commission_cents), eur(r.q1_cents), eur(r.q2_cents), eur(r.q3_cents), eur(r.q4_cents)]
        .map(esc)
        .join(';'),
    );
    const csv = `﻿${header.join(';')}\n${lines.join('\n')}\n`;
    const key = `exports/dac7/dac7-${year}-${Date.now()}.csv`;
    await this.storage.put(key, Buffer.from(csv, 'utf8'), 'text/csv; charset=utf-8');
    await this.audit.log(admin.id, 'export.dac7', 'export', null, { year, rows: rows.length, key });
    return { url: await this.storage.presignGet(key, 300, `dac7-${year}.csv`), rows: rows.length };
  }
}
