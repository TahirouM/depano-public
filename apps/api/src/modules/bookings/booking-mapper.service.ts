import { Inject, Injectable } from '@nestjs/common';
import {
  RULES,
  artisanCanSeeExactAddress,
  chatIsOpen,
  type Actor,
  type BookingDetailDto,
  type BookingEventDto,
  type BookingStatus,
  type BookingSummaryDto,
  type DisputeDto,
  type DomainCode,
  type NotFeasibleReason,
  type QuoteDto,
  type ReportDto,
  type ScheduledType,
} from '@depano/schemas';
import {
  addresses,
  artisanProfiles,
  bookingEvents,
  bookingLocations,
  bookings,
  conversations,
  desc,
  dispatchOffers,
  disputes,
  eq,
  inArray,
  interventionReports,
  invoices,
  and,
  quoteLines,
  quotes,
  services,
  sql,
  users,
} from '@depano/db';
import { DbConnection } from '../../infra/db';
import { FilesService } from '../files/files.service';
import { ChatService } from '../chat/chat.service';
import { ReviewsService } from '../catalog/reviews.service';
import { CompletionCodeService } from './completion-code.service';
import type { BookingRow } from './booking-state.service';
import { allowedTransitionsFor, approx, canReview, clientCancellationTerms, maskPhone, requestDeadline, type Viewer } from './booking-rules';

const CODE_VISIBLE: BookingStatus[] = ['accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code'];

/** Construction des DTO d'intervention selon l'appelant (masquage de l'adresse, code de fin…). */
@Injectable()
export class BookingMapper {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(ReviewsService) private readonly reviewsService: ReviewsService,
    @Inject(CompletionCodeService) private readonly codes: CompletionCodeService,
  ) {}

  async toSummaries(rows: BookingRow[], viewer: Viewer): Promise<BookingSummaryDto[]> {
    if (!rows.length) return [];
    const db = this.conn.db;
    const serviceIds = [...new Set(rows.map((r) => r.serviceId).filter((x): x is string => !!x))];
    const artisanIds = [...new Set(rows.map((r) => r.artisanId).filter((x): x is string => !!x))];
    const requestedIds = rows.filter((r) => r.status === 'requested').map((r) => r.id);
    const [svc, addr, arts, clients, convs, requestedEvents] = await Promise.all([
      serviceIds.length ? db.select({ id: services.id, name: services.name }).from(services).where(inArray(services.id, serviceIds)) : [],
      db.select({ id: addresses.id, city: addresses.city }).from(addresses).where(inArray(addresses.id, [...new Set(rows.map((r) => r.addressId))])),
      artisanIds.length
        ? db
            .select({ id: artisanProfiles.id, name: artisanProfiles.displayName, avatar: users.avatarFileId })
            .from(artisanProfiles)
            .innerJoin(users, eq(users.id, artisanProfiles.userId))
            .where(inArray(artisanProfiles.id, artisanIds))
        : [],
      db.select({ id: users.id, first: users.firstName, avatar: users.avatarFileId }).from(users).where(inArray(users.id, [...new Set(rows.map((r) => r.clientId))])),
      db.select().from(conversations).where(inArray(conversations.bookingId, rows.map((r) => r.id))),
      requestedIds.length
        ? db
            .select({ bookingId: bookingEvents.bookingId, at: sql<Date>`max(${bookingEvents.createdAt})`.mapWith(bookingEvents.createdAt) })
            .from(bookingEvents)
            .where(and(inArray(bookingEvents.bookingId, requestedIds), eq(bookingEvents.toStatus, 'requested')))
            .groupBy(bookingEvents.bookingId)
        : [],
    ]);
    const requestedAt = new Map(requestedEvents.map((e) => [e.bookingId, e.at]));
    const svcMap = new Map(svc.map((s) => [s.id, s.name]));
    const addrMap = new Map(addr.map((a) => [a.id, a.city]));
    const artMap = new Map(arts.map((a) => [a.id, a]));
    const cliMap = new Map(clients.map((c) => [c.id, c]));
    const convMap = new Map(convs.map((c) => [c.bookingId, c]));
    return Promise.all(
      rows.map(async (b) => {
        let counterpart: BookingSummaryDto['counterpart'] = null;
        if (viewer.actor === 'artisan') {
          const c = cliMap.get(b.clientId);
          counterpart = c ? { id: c.id, name: c.first ?? 'Client', avatarUrl: await this.filesService.signedUrl(c.avatar) } : null;
        } else if (b.artisanId) {
          const a = artMap.get(b.artisanId);
          counterpart = a ? { id: a.id, name: a.name, avatarUrl: await this.filesService.signedUrl(a.avatar) } : null;
        }
        // Messagerie fermée tant que l'artisan n'a pas accepté la demande.
        const conv = chatIsOpen({ status: b.status as BookingStatus, artisanAcceptedAt: b.artisanAcceptedAt }) ? convMap.get(b.id) : undefined;
        return {
          id: b.id,
          reference: b.reference,
          kind: b.kind,
          status: b.status as BookingStatus,
          domain: b.domain as DomainCode,
          serviceName: b.serviceId ? (svcMap.get(b.serviceId) ?? null) : null,
          problemReason: b.problemReason,
          scheduledAt: b.scheduledAt?.toISOString() ?? null,
          createdAt: b.createdAt.toISOString(),
          totalCents: b.totalCents,
          city: addrMap.get(b.addressId) ?? '',
          counterpart,
          unreadMessages: conv && viewer.actor !== 'support' ? await this.chat.unreadCount(conv, viewer.userId) : 0,
          priceOnRequest: b.priceOnRequest,
          artisanAccepted: !!b.artisanAcceptedAt,
          rescheduledFromId: b.rescheduledFromId,
          artisanNote: viewer.actor === 'artisan' ? b.artisanNote : null,
          endsAt: b.endsAt?.toISOString() ?? null,
          requestExpiresAt: this.requestExpiresAt(b, requestedAt.get(b.id))?.toISOString() ?? null,
        };
      }),
    );
  }

  /** Échéance de réponse : de l'artisan (demande), du client (prix ou report proposé). */
  private requestExpiresAt(b: BookingRow, requestedAt: Date | undefined): Date | null {
    if (b.status === 'requested') return requestDeadline(b, requestedAt ?? b.createdAt);
    if (b.status === 'pending_payment' && b.artisanAcceptedAt) return requestDeadline(b, b.artisanAcceptedAt);
    return null;
  }

  async toDetail(b: BookingRow, viewer: Viewer): Promise<BookingDetailDto> {
    const db = this.conn.db;
    const [summary] = await this.toSummaries([b], viewer);
    const [address] = await db.select().from(addresses).where(eq(addresses.id, b.addressId));
    const [artisan] = b.artisanId
      ? await db
          .select({ id: artisanProfiles.id, name: artisanProfiles.displayName, rating: artisanProfiles.ratingAvg, avatar: users.avatarFileId, phone: users.phone })
          .from(artisanProfiles)
          .innerJoin(users, eq(users.id, artisanProfiles.userId))
          .where(eq(artisanProfiles.id, b.artisanId))
      : [];
    const [client] = await db.select({ id: users.id, first: users.firstName, avatar: users.avatarFileId }).from(users).where(eq(users.id, b.clientId));
    const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, b.id)).orderBy(bookingEvents.createdAt);
    const [quote] = await db.select().from(quotes).where(eq(quotes.bookingId, b.id)).orderBy(desc(quotes.createdAt)).limit(1);
    const lines = quote ? await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id)).orderBy(quoteLines.position) : [];
    const [report] = await db.select().from(interventionReports).where(eq(interventionReports.bookingId, b.id));
    const review = await this.reviewsService.forBooking(b.id);
    const [dispute] = await db.select().from(disputes).where(eq(disputes.bookingId, b.id));
    const conv = chatIsOpen({ status: b.status as BookingStatus, artisanAcceptedAt: b.artisanAcceptedAt }) ? await this.chat.conversationForBooking(b.id) : null;
    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.bookingId, b.id), eq(invoices.kind, viewer.actor === 'artisan' ? 'commission' : 'service')));
    const [location] = ['en_route', 'arrived'].includes(b.status)
      ? await db.select().from(bookingLocations).where(eq(bookingLocations.bookingId, b.id)).orderBy(desc(bookingLocations.createdAt)).limit(1)
      : [];
    let dispatch: BookingDetailDto['dispatch'] = null;
    if (b.kind === 'urgent' && b.dispatchWave > 0) {
      const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(dispatchOffers).where(eq(dispatchOffers.bookingId, b.id));
      dispatch = { wave: b.dispatchWave, contacted: c?.n ?? 0, radiusKm: RULES.dispatch.radiiKm[b.dispatchWave - 1] ?? RULES.dispatch.radiiKm[2] };
    }

    const hideAddress = viewer.actor === 'artisan' && !artisanCanSeeExactAddress(b.status as BookingStatus);
    const terms = clientCancellationTerms(b);
    const quoteDto: QuoteDto | null = quote
      ? {
          id: quote.id,
          status: quote.status,
          lines: lines.map((l) => ({ id: l.id, kind: l.kind, label: l.label, quantity: l.quantity, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents })),
          totalCents: quote.totalCents,
          needsNewAuthorization: quote.needsNewAuthorization,
          keepReplacedParts: quote.keepReplacedParts,
          expiresAt: quote.expiresAt.toISOString(),
          createdAt: quote.createdAt.toISOString(),
          answeredAt: quote.answeredAt?.toISOString() ?? null,
        }
      : null;
    const reportDto: ReportDto | null = report
      ? {
          feasible: report.feasible,
          materials: report.materials,
          notes: report.notes,
          voiceTranscript: report.voiceTranscript,
          followUpNeeded: report.followUpNeeded,
          beforePhotoUrls: await this.filesService.signedUrls(report.beforeFileIds),
          afterPhotoUrls: await this.filesService.signedUrls(report.afterFileIds),
          createdAt: report.createdAt.toISOString(),
        }
      : null;
    const disputeDto: DisputeDto | null = dispute ? toDisputeDto(dispute) : null;
    const etaMinutes = b.status === 'en_route' && b.etaAt ? Math.max(0, Math.round((b.etaAt.getTime() - Date.now()) / 60_000)) : null;
    const totalBase = b.basePriceCents + b.travelFeeCents + b.urgentFeeCents + b.guaranteeCents - b.discountCents;
    const notFeasible: BookingDetailDto['notFeasible'] =
      report && !report.feasible && report.notFeasibleReason
        ? {
            reason: report.notFeasibleReason as NotFeasibleReason,
            comment: report.notes,
            photoUrls: await this.filesService.signedUrls(report.beforeFileIds),
            rescheduledBookingId: report.rescheduledBookingId,
          }
        : null;

    return {
      ...summary!,
      scheduledType: (b.scheduledType as ScheduledType | null) ?? null,
      problemDescription: b.problemDescription,
      problemPhotoUrls: await this.filesService.signedUrls(b.problemFileIds),
      address: {
        line1: hideAddress ? null : (address?.line1 ?? null),
        postalCode: address?.postalCode ?? '',
        city: address?.city ?? '',
        floor: hideAddress ? null : (address?.floor ?? null),
        doorCode: hideAddress ? null : (address?.doorCode ?? null),
        accessNotes: hideAddress ? null : (address?.accessNotes ?? null),
        lat: hideAddress ? null : (address?.lat ?? null),
        lng: hideAddress ? null : (address?.lng ?? null),
        approxLat: approx(address?.lat ?? 0),
        approxLng: approx(address?.lng ?? 0),
      },
      price: {
        baseCents: b.basePriceCents,
        urgentFeeCents: b.urgentFeeCents,
        guaranteeCents: b.guaranteeCents,
        travelFeeCents: b.travelFeeCents,
        discountCents: b.discountCents,
        totalCents: totalBase,
        rangeMinCents: totalBase,
        rangeMaxCents: Math.round(totalBase * (1 + RULES.quoteOverrunThreshold)),
      },
      authorizedCents: b.authorizedCents,
      capturedCents: b.capturedCents,
      commissionCents: viewer.actor === 'client' ? null : b.commissionCents,
      withGuarantee: b.withGuarantee,
      artisan: artisan
        ? {
            id: artisan.id,
            displayName: artisan.name,
            avatarUrl: await this.filesService.signedUrl(artisan.avatar),
            ratingAvg: artisan.rating,
            phoneMasked: maskPhone(artisan.phone),
          }
        : null,
      client: client ? { id: client.id, firstName: client.first ?? 'Client', avatarUrl: await this.filesService.signedUrl(client.avatar) } : null,
      etaMinutes,
      artisanLocation: location && viewer.actor !== 'artisan' ? { lat: location.lat, lng: location.lng } : null,
      completionCode: viewer.actor === 'client' && CODE_VISIBLE.includes(b.status as BookingStatus) ? this.codes.reveal(b.completionCodeEnc) : null,
      completionAttemptsLeft: Math.max(0, RULES.completionCode.maxAttempts - b.completionAttempts),
      events: events.map(
        (e): BookingEventDto => ({
          id: e.id,
          fromStatus: (e.fromStatus as BookingStatus | null) ?? null,
          toStatus: e.toStatus as BookingStatus,
          actor: e.actor,
          note: e.note,
          lat: viewer.actor === 'support' ? e.lat : null,
          lng: viewer.actor === 'support' ? e.lng : null,
          createdAt: e.createdAt.toISOString(),
        }),
      ),
      quote: quoteDto,
      report: reportDto,
      review: review ? ((await this.reviewsService.toDtos([review]))[0] ?? null) : null,
      dispute: disputeDto,
      conversationId: conv?.id ?? null,
      invoiceId: invoice?.id ?? null,
      notFeasible,
      dispatch,
      allowedTransitions: allowedTransitionsFor(b, viewer.actor as Actor),
      canReview: canReview(b, viewer, !!review),
      cancellationIsFree: viewer.actor === 'client' ? terms.free : true,
      cancellationFeeCents: viewer.actor === 'client' ? terms.feeCents : 0,
    };
  }

  async reload(id: string) {
    const [b] = await this.conn.db.select().from(bookings).where(eq(bookings.id, id));
    return b!;
  }
}

export function toDisputeDto(d: typeof disputes.$inferSelect): DisputeDto {
  return {
    id: d.id,
    reason: d.reason,
    description: d.description,
    status: d.status,
    resolution: d.resolution ?? null,
    resolutionNote: d.resolutionNote,
    refundedCents: d.refundedCents,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
  };
}
