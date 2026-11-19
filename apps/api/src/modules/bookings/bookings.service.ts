import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ACTIVE_BOOKING_STATUSES,
  DEEP_LINKS,
  NOT_FEASIBLE_REASON_LABELS,
  RULES,
  TERMINAL_BOOKING_STATUSES,
  clientDisputeBlockedReason,
  computeCommission,
  computePrice,
  formatEuros,
  quoteNeedsNewAuthorization,
  type AnswerQuoteBody,
  type ArtisanNoteBody,
  type BookingDetailDto,
  type BookingListQuery,
  type BookingStatus,
  type CallRelayDto,
  type CancelBookingBody,
  type CompletionCodeErrorDetails,
  type CreateBookingBody,
  type CreateBookingResult,
  type CreateQuoteBody,
  type DisputeBody,
  type LocationBody,
  type NotFeasibleBody,
  type Paginated,
  type PaymentSessionDto,
  type ReportBody,
  type RespondRequestBody,
  type ReviewBody,
  type ReviewDto,
  type BookingSummaryDto,
  type TransitionBody,
} from '@depano/schemas';
import {
  addresses,
  and,
  artisanProfiles,
  artisanServices,
  bookingLocations,
  bookings,
  desc,
  disputes,
  eq,
  inArray,
  interventionReports,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  quoteLines,
  quotes,
  referralCredits,
  services,
  sql,
  users,
  zones,
  type Tx,
} from '@depano/db';
import { DbConnection } from '../../infra/db';
import { JobsService } from '../../infra/jobs';
import { RateLimiter } from '../../infra/redis';
import { RealtimeService } from '../../infra/realtime';
import { CALL_RELAY_PROVIDER } from '../../infra/tokens';
import type { CallRelayProvider } from '../../providers/messaging.providers';
import type { AuthUser } from '../../common/auth';
import { AppError, badRequest, conflict, forbidden, gone, locked, notFound, paymentRequired } from '../../common/errors';
import { bookingReference } from '../../common/crypto';
import { decodeTimeCursor, encodeTimeCursor } from '../../common/pagination';
import { distanceKm, formatParis, hours, minutes, naiveEtaMinutes } from '../../common/time';
import { BookingStateService, type BookingRow } from './booking-state.service';
import { BookingMapper } from './booking-mapper.service';
import { CompletionCodeService } from './completion-code.service';
import { clientCancellationTerms, closingAmount, requestDeadline, type Viewer } from './booking-rules';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { ChatService } from '../chat/chat.service';
import { SlotsService } from '../catalog/slots.service';
import { offeredBy } from '../catalog/offer';
import { ReviewsService } from '../catalog/reviews.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { AuditService } from '../admin/audit.service';
import { ReliabilityService } from '../maintenance/reliability.service';
import { ReferralService } from '../me/referral.service';

export const DEFAULT_TRAVEL_FEE_CENTS = 2500;
export const QUOTE_TTL_MINUTES = 30;
const CALLABLE: BookingStatus[] = ['accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'disputed'];
const LOCATION_STATUSES: BookingStatus[] = ['accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress'];

const pgCode = (e: unknown) => (e as { cause?: { code?: string }; code?: string }).cause?.code ?? (e as { code?: string }).code;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger('Bookings');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(CALL_RELAY_PROVIDER) private readonly relay: CallRelayProvider,
    @Inject(BookingStateService) private readonly state: BookingStateService,
    @Inject(BookingMapper) readonly mapper: BookingMapper,
    @Inject(CompletionCodeService) private readonly codes: CompletionCodeService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(SlotsService) private readonly slots: SlotsService,
    @Inject(ReviewsService) private readonly reviewsService: ReviewsService,
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ReliabilityService) private readonly reliability: ReliabilityService,
    @Inject(ReferralService) private readonly referral: ReferralService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Accès                                                              */
  /* ------------------------------------------------------------------ */

  async load(id: string): Promise<BookingRow> {
    const [b] = await this.conn.db.select().from(bookings).where(eq(bookings.id, id));
    if (!b) throw notFound('booking_not_found', 'Intervention introuvable.');
    return b;
  }

  private async artisanOf(userId: string) {
    const [a] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.userId, userId));
    return a ?? null;
  }

  /** Détermine le rôle de l'appelant vis-à-vis de l'intervention, ou refuse l'accès. */
  async viewerFor(user: Pick<AuthUser, 'id' | 'roles'>, b: BookingRow, opts: { allowOffered?: boolean; allowStaff?: boolean } = {}): Promise<Viewer> {
    if (b.clientId === user.id) return { userId: user.id, actor: 'client' };
    const artisan = await this.artisanOf(user.id);
    if (artisan && b.artisanId === artisan.id) return { userId: user.id, actor: 'artisan', artisanId: artisan.id };
    if (artisan && opts.allowOffered !== false && !b.artisanId && (await this.dispatch.hasOffer(b.id, artisan.id))) {
      return { userId: user.id, actor: 'artisan', artisanId: artisan.id };
    }
    if (opts.allowStaff !== false && (user.roles.includes('support') || user.roles.includes('admin'))) return { userId: user.id, actor: 'support' };
    throw forbidden('booking_forbidden', "Vous n'avez pas accès à cette intervention.");
  }

  async canAccess(user: Pick<AuthUser, 'id' | 'roles'>, bookingId: string) {
    try {
      await this.viewerFor(user, await this.load(bookingId));
      return true;
    } catch {
      return false;
    }
  }

  async get(user: AuthUser, id: string): Promise<BookingDetailDto> {
    const b = await this.load(id);
    return this.mapper.toDetail(b, await this.viewerFor(user, b));
  }

  private async requireActor(user: AuthUser, b: BookingRow, actor: 'client' | 'artisan', message: string) {
    const v = await this.viewerFor(user, b, { allowOffered: false, allowStaff: false }).catch(() => null);
    if (!v || v.actor !== actor) throw forbidden('booking_forbidden', message);
    return v;
  }

  /* ------------------------------------------------------------------ */
  /* Création et paiement                                               */
  /* ------------------------------------------------------------------ */

  async create(user: AuthUser, body: CreateBookingBody): Promise<CreateBookingResult> {
    await this.limiter.hit(`booking:${user.id}`, 10, 3600, 'Trop de demandes créées, réessayez dans un moment.');
    const db = this.conn.db;
    const now = new Date();

    let service: typeof services.$inferSelect | null = null;
    if (body.serviceId) {
      const [s] = await db.select().from(services).where(and(eq(services.id, body.serviceId), eq(services.active, true)));
      if (!s || s.domain !== body.domain) throw badRequest('invalid_service', 'Prestation invalide pour ce métier.');
      // Motif personnel : réservable uniquement en RDV auprès de l'artisan qui l'a créé.
      if (s.ownerArtisanId && (body.kind !== 'scheduled' || s.ownerArtisanId !== body.artisanId)) {
        throw badRequest('invalid_service', 'Prestation invalide pour ce métier.');
      }
      if (body.kind === 'urgent' && !s.urgentEligible) throw badRequest('service_not_urgent', "Cette prestation n'est pas disponible en urgence.");
      service = s;
    }
    await this.filesService.assertOwned(user.id, body.problemFileIds, ['problem_photo', 'problem_voice']);

    // Adresse : enregistrée, ou saisie à la volée (masquée du carnet si non nommée).
    let address: typeof addresses.$inferSelect;
    if (body.addressId) {
      const [a] = await db.select().from(addresses).where(and(eq(addresses.id, body.addressId), eq(addresses.userId, user.id), isNull(addresses.deletedAt)));
      if (!a) throw badRequest('invalid_address', 'Adresse introuvable.');
      address = a;
    } else {
      const { saveAs, ...a } = body.address!;
      const [created] = await db
        .insert(addresses)
        .values({ ...a, userId: user.id, label: saveAs ?? 'Intervention', deletedAt: saveAs ? null : now })
        .returning();
      address = created!;
    }

    const [zone] = await db
      .select()
      .from(zones)
      .where(and(eq(zones.active, true), sql`ST_DWithin(${zones.center}, ST_SetSRID(ST_MakePoint(${address.lng}, ${address.lat}), 4326)::geography, ${zones.radiusKm} * 1000)`))
      .orderBy(sql`ST_Distance(${zones.center}, ST_SetSRID(ST_MakePoint(${address.lng}, ${address.lat}), 4326)::geography)`)
      .limit(1);
    if (body.kind === 'urgent' && !zone) throw badRequest('out_of_zone', "DEPANO n'est pas encore disponible à cette adresse.");

    let artisan: typeof artisanProfiles.$inferSelect | null = null;
    let basePriceCents: number;
    let travelFeeCents = DEFAULT_TRAVEL_FEE_CENTS;
    let scheduledAt: Date | null = null;
    let endsAt: Date | null = null;

    if (body.kind === 'scheduled') {
      const [a] = await db.select().from(artisanProfiles).where(eq(artisanProfiles.id, body.artisanId!));
      if (!a || a.status !== 'approved') throw badRequest('invalid_artisan', 'Artisan indisponible.');
      if (a.userId === user.id) throw badRequest('self_booking', 'Vous ne pouvez pas réserver votre propre profil.');
      if (!a.domains.includes(body.domain)) throw badRequest('invalid_domain', "Cet artisan n'intervient pas dans ce métier.");
      if (a.baseLat != null && a.baseLng != null && distanceKm({ lat: a.baseLat, lng: a.baseLng }, address) > a.radiusKm) {
        throw badRequest('out_of_area', "Cette adresse est hors de la zone d'intervention de l'artisan.");
      }
      artisan = a;
      travelFeeCents = a.travelFeeCents;
      const offered = await db
        .select({ price: artisanServices.priceCents, serviceId: artisanServices.serviceId, domain: services.domain })
        .from(artisanServices)
        .innerJoin(services, eq(services.id, artisanServices.serviceId))
        .where(offeredBy(a.id));
      if (body.priceOnRequest) {
        // Demande « Autre » : le prix sera proposé par l'artisan.
        basePriceCents = 0;
      } else if (service) {
        const o = offered.find((x) => x.serviceId === service!.id);
        if (!o) throw badRequest('service_not_offered', "Cet artisan ne propose pas cette prestation.");
        basePriceCents = o.price;
      } else {
        const inDomain = offered.filter((x) => x.domain === body.domain).map((x) => x.price);
        basePriceCents = inDomain.length ? Math.min(...inDomain) : 0;
      }
      scheduledAt = new Date(body.scheduledAt!);
      if (!(await this.slots.isAvailable(a.id, body.serviceId, scheduledAt, now))) {
        throw conflict('slot_unavailable', "Ce créneau n'est plus disponible.");
      }
      endsAt = new Date(scheduledAt.getTime() + minutes(await this.slots.durationFor(a.id, body.serviceId)));
    } else if (service) {
      basePriceCents = service.referencePriceCents;
    } else {
      const [r] = await db
        .select({ p: sql<number>`min(${services.referencePriceCents})::int` })
        .from(services)
        .where(and(eq(services.domain, body.domain), eq(services.active, true), isNull(services.ownerArtisanId), eq(services.urgentEligible, true)));
      basePriceCents = r?.p ?? 0;
    }

    const price = computePrice({ basePriceCents, travelFeeCents, urgent: body.kind === 'urgent', withGuarantee: body.withGuarantee });
    // Demande de prix : pas de paiement, directement en attente de l'artisan (le créneau est réservé).
    const status = body.priceOnRequest ? 'requested' : 'pending_payment';
    let row: BookingRow | undefined;
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      try {
        row = await db.transaction(async (tx) => {
          const [b] = await tx
            .insert(bookings)
            .values({
              reference: bookingReference(),
              kind: body.kind,
              status,
              clientId: user.id,
              artisanId: artisan?.id ?? null,
              domain: body.domain,
              serviceId: service?.id ?? null,
              scheduledType: body.kind === 'scheduled' ? (body.scheduledType ?? (service?.kind === 'maintenance' ? 'maintenance' : 'repair')) : null,
              addressId: address.id,
              problemReason: body.problemReason,
              problemDescription: body.problemDescription ?? null,
              problemFileIds: body.problemFileIds,
              scheduledAt,
              endsAt,
              basePriceCents: price.baseCents,
              travelFeeCents: price.travelFeeCents,
              urgentFeeCents: price.urgentFeeCents,
              guaranteeCents: price.guaranteeCents,
              totalCents: price.totalCents,
              commissionRate: zone?.commissionRate ?? RULES.defaultCommissionRate,
              withGuarantee: body.withGuarantee,
              waivesWithdrawal: body.waivesWithdrawal,
              priceOnRequest: body.priceOnRequest,
              zoneId: zone?.id ?? null,
            })
            .returning();
          await this.state.logCreation(tx, b!.id, user.id, { status });
          // La messagerie ne s'ouvre qu'à l'acceptation par l'artisan (aucune conversation ici).
          return this.applyReferralDiscount(tx, b!);
        });
      } catch (e) {
        const code = pgCode(e);
        if (code === '23P01') throw conflict('slot_unavailable', "Ce créneau vient d'être réservé.");
        if (code === '23505' && String((e as { cause?: { constraint_name?: string } }).cause?.constraint_name ?? e).includes('reference')) continue;
        throw e;
      }
    }
    if (!row) throw new Error('Impossible de générer une référence unique');
    let payment: PaymentSessionDto | null = null;
    if (row.status === 'requested') {
      await this.onRequested(row, row.createdAt);
    } else {
      payment = await this.payments.createSession(row, body.paymentMethodId);
    }
    const fresh = await this.load(row.id);
    return { booking: await this.mapper.toDetail(fresh, { userId: user.id, actor: 'client' }), payment };
  }

  /** Crédit de parrainage du client : consommé par l'intervention créée, déduit du total (même transaction). */
  private async applyReferralDiscount(tx: Tx, b: BookingRow): Promise<BookingRow> {
    const discountCents = await this.referral.consume(tx, b.clientId, b.id, b.totalCents);
    if (!discountCents) return b;
    const [updated] = await tx
      .update(bookings)
      .set({ discountCents, totalCents: b.totalCents - discountCents })
      .where(eq(bookings.id, b.id))
      .returning();
    return updated!;
  }

  /** Demande envoyée à l'artisan : expiration programmée (+ notification pour une demande créée sans transition). */
  private async onRequested(b: BookingRow, requestedAt: Date) {
    const deadline = requestDeadline(b, requestedAt);
    await this.jobs.add('bookings', 'request-expire', { bookingId: b.id }, { delayMs: Math.max(0, deadline.getTime() - Date.now()), jobId: `request-${b.id}` });
    if (b.status === 'requested' && b.priceOnRequest && b.artisanId) {
      const [a] = await this.conn.db.select({ userId: artisanProfiles.userId }).from(artisanProfiles).where(eq(artisanProfiles.id, b.artisanId));
      if (a) {
        await this.notifications.notify(a.userId, {
          type: 'booking_requested',
          title: 'Nouvelle demande de prix',
          body: `${b.problemReason} — ${b.scheduledAt ? formatParis(b.scheduledAt) : ''}. Proposez un prix ou refusez la demande.`,
          link: DEEP_LINKS.intervention(b.id),
          data: { bookingId: b.id, status: b.status },
        });
      }
    }
  }

  /** Vérifie l'empreinte auprès du prestataire puis lance le dispatch (urgence) ou confirme le RDV. */
  async confirmPayment(userId: string | null, bookingId: string): Promise<BookingRow> {
    let b = await this.load(bookingId);
    if (userId && b.clientId !== userId) throw forbidden('booking_forbidden', "Vous n'avez pas accès à cette intervention.");
    if (b.status !== 'pending_payment') {
      // Après la payment sheet d'un complément de devis (> autorisé + 20 %) : on confirme l'autorisation.
      const sup = await this.payments.syncSupplements(b.id);
      if (userId && sup.failed && !sup.authorized && !sup.pending) {
        throw paymentRequired('supplement_failed', 'Le paiement complémentaire a été refusé. Essayez une autre carte ou contactez votre banque.');
      }
      if (userId && sup.pending) {
        throw paymentRequired('supplement_not_authorized', "Le paiement complémentaire n'a pas encore été validé. Réessayez dans un instant.");
      }
      return sup.authorized ? this.load(b.id) : b;
    }
    const sync = await this.payments.syncPending(b.id);
    if (!sync.ok) throw paymentRequired('payment_not_authorized', "Le paiement n'a pas encore été validé. Réessayez dans un instant.");
    try {
      if (b.kind === 'urgent') {
        b = await this.state.transition(b.id, 'searching', 'system', userId, { patch: { dispatchStartedAt: new Date() } });
        await this.jobs.add('dispatch', 'start', { bookingId: b.id }, { jobId: `start-${b.id}` });
      } else if (b.artisanAcceptedAt) {
        // Prix proposé ou report proposé par l'artisan : déjà accepté, le paiement confirme le RDV.
        b = await this.state.transition(b.id, 'accepted', 'system', userId, {
          patch: (row) => this.codes.generate(row.id),
          inTx: async (tx, row) => {
            await this.ensureConversationTx(tx, row);
          },
        });
        await this.jobs.remove('bookings', `request-${b.id}`);
        await this.scheduleReminders(b, sync.setup);
      } else {
        // Demande de RDV : l'artisan accepte ou refuse (POST /bookings/:id/respond).
        b = await this.state.transition(b.id, 'requested', 'system', userId);
        await this.onRequested(b, new Date());
      }
    } catch (e) {
      if (e instanceof AppError && e.code === 'invalid_transition') return this.load(b.id);
      throw e;
    }
    return b;
  }

  private async scheduleReminders(b: BookingRow, deferredAuthorization: boolean) {
    if (!b.scheduledAt) return;
    const at = b.scheduledAt.getTime();
    const now = Date.now();
    if (at - hours(24) > now) await this.jobs.add('bookings', 'reminder', { bookingId: b.id, kind: 'day_before' }, { delayMs: at - hours(24) - now, jobId: `reminder-${b.id}-day` });
    if (at - hours(1) > now) await this.jobs.add('bookings', 'reminder', { bookingId: b.id, kind: 'hour_before' }, { delayMs: at - hours(1) - now, jobId: `reminder-${b.id}-hour` });
    if (deferredAuthorization) {
      await this.jobs.add('bookings', 'authorize-scheduled', { bookingId: b.id }, { delayMs: Math.max(0, at - hours(24) - now), jobId: `authorize-${b.id}` });
    }
  }

  async confirmPaymentDetail(user: AuthUser, bookingId: string) {
    const b = await this.confirmPayment(user.id, bookingId);
    return this.mapper.toDetail(b, { userId: user.id, actor: 'client' });
  }

  /** Session de paiement d'une intervention en attente du client (prix proposé, report proposé par l'artisan). */
  async paymentSession(user: AuthUser, id: string): Promise<PaymentSessionDto> {
    const b = await this.load(id);
    await this.requireActor(user, b, 'client', 'Seul le client peut régler cette intervention.');
    if (b.status !== 'pending_payment') throw conflict('payment_not_expected', "Aucun paiement n'est attendu pour cette intervention.");
    return this.payments.sessionFor(b);
  }

  private async ensureConversationTx(tx: Tx, b: BookingRow) {
    if (!b.artisanId) return;
    const [a] = await tx.select({ userId: artisanProfiles.userId }).from(artisanProfiles).where(eq(artisanProfiles.id, b.artisanId));
    if (a) await this.chat.ensureConversation(tx, b.id, b.clientId, a.userId);
  }

  /** Carte enregistrée sans empreinte (RDV lointain) : l'autorisation sera faite 24 h avant. */
  private async hasDeferredAuthorization(bookingId: string) {
    const rows = await this.payments.listForBooking(bookingId);
    return rows.some((p) => p.kind === 'setup' && p.status === 'authorized') && !rows.some((p) => p.kind === 'authorization' && p.status === 'authorized');
  }

  /* ------------------------------------------------------------------ */
  /* Demandes de RDV (réponse de l'artisan)                             */
  /* ------------------------------------------------------------------ */

  async respond(user: AuthUser, id: string, body: RespondRequestBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'artisan', "Seul l'artisan sollicité peut répondre à la demande.");
    const guard = (row: BookingRow) => {
      if (row.status !== 'requested') throw conflict('request_not_pending', "Cette demande n'est plus en attente de réponse.");
    };
    if (body.accept && b.priceOnRequest && !body.priceCents) throw badRequest('price_required', 'Indiquez le prix de la prestation pour accepter la demande.');
    if (!body.accept) {
      // Refus d'une demande : ce n'est pas l'annulation d'un RDV accepté, la fiabilité de l'artisan n'est pas affectée.
      await this.state.transition(b.id, 'cancelled_by_artisan', 'artisan', user.id, {
        note: body.message ?? 'Demande refusée',
        guard,
        patch: { cancellationReason: body.message ?? "Demande refusée par l'artisan" },
      });
      await this.payments.releaseAll(b.id);
    } else if (b.priceOnRequest) {
      const price = computePrice({
        basePriceCents: body.priceCents!,
        travelFeeCents: b.travelFeeCents,
        urgent: false,
        withGuarantee: b.withGuarantee,
        discountCents: await this.referral.creditFor(b.id),
      });
      const endsAt = body.durationMinutes && b.scheduledAt ? new Date(b.scheduledAt.getTime() + minutes(body.durationMinutes)) : null;
      const now = new Date();
      try {
        await this.state.transition(b.id, 'pending_payment', 'artisan', user.id, {
          note: body.message ?? `Prix proposé : ${formatEuros(price.totalCents)}`,
          guard,
          patch: { basePriceCents: price.baseCents, discountCents: price.discountCents, totalCents: price.totalCents, artisanAcceptedAt: now, ...(endsAt ? { endsAt } : {}) },
          inTx: (tx, row) => this.ensureConversationTx(tx, row),
        });
      } catch (e) {
        if (pgCode(e) === '23P01') throw conflict('slot_unavailable', 'Cette durée chevauche un autre rendez-vous de votre planning.');
        throw e;
      }
      // Le client a 24 h (au plus tard l'heure du RDV) pour valider le prix en payant.
      const deadline = requestDeadline(b, now);
      await this.jobs.remove('bookings', `request-${b.id}`);
      await this.jobs.add('bookings', 'request-expire', { bookingId: b.id }, { delayMs: Math.max(0, deadline.getTime() - Date.now()), jobId: `request-${b.id}` });
    } else {
      const accepted = await this.state.transition(b.id, 'accepted', 'artisan', user.id, {
        note: body.message ?? null,
        guard,
        patch: (row) => ({ ...this.codes.generate(row.id), artisanAcceptedAt: new Date() }),
        inTx: (tx, row) => this.ensureConversationTx(tx, row),
      });
      await this.scheduleReminders(accepted, await this.hasDeferredAuthorization(b.id));
    }
    if (!(body.accept && b.priceOnRequest)) await this.jobs.remove('bookings', `request-${b.id}`);
    if (body.accept && body.message?.trim()) {
      const conv = await this.chat.conversationForBooking(b.id);
      if (conv) {
        await this.chat
          .send(user.id, conv.id, { clientId: `respond-${b.id}`, kind: 'text', body: body.message.trim() })
          .catch((e) => this.logger.warn(`message de réponse ${b.reference} : ${e}`));
      }
    }
    return this.mapper.toDetail(await this.load(b.id), viewer);
  }

  /** Job request-expire : demande sans réponse de l'artisan, ou prix / report proposé jamais validé par le client. */
  async expireRequest(bookingId: string) {
    const b = await this.load(bookingId);
    const awaitingClient = b.status === 'pending_payment' && !!b.artisanAcceptedAt;
    if (b.status !== 'requested' && !awaitingClient) return { skipped: true, status: b.status };
    try {
      await this.state.transition(b.id, awaitingClient ? 'cancelled_by_client' : 'expired', 'system', null, {
        note: awaitingClient ? 'Proposition non validée à temps' : "Pas de réponse de l'artisan",
        guard: (row) => {
          if (row.status !== b.status) throw conflict('invalid_transition', 'Intervention modifiée entre-temps.');
        },
        patch: awaitingClient ? { cancellationReason: 'Proposition non validée à temps' } : {},
      });
    } catch (e) {
      if (e instanceof AppError && e.code === 'invalid_transition') return { skipped: true };
      throw e;
    }
    await this.payments.releaseAll(b.id);
    return { expired: true };
  }

  /** Note privée de l'artisan (jamais visible du client). */
  async setArtisanNote(user: AuthUser, id: string, body: ArtisanNoteBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'artisan', "Seul l'artisan de l'intervention peut annoter l'intervention.");
    const [updated] = await this.conn.db
      .update(bookings)
      .set({ artisanNote: body.note?.trim() || null, updatedAt: new Date() })
      .where(eq(bookings.id, b.id))
      .returning();
    return this.mapper.toDetail(updated!, viewer);
  }

  /* ------------------------------------------------------------------ */
  /* Intervention non réalisable                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Sur place, l'intervention est impossible : seuls les frais de déplacement sont dus (capture à la saisie du code
   * ou automatique 24 h après, litige possible). L'artisan annule, ou propose une nouvelle date que le client valide.
   */
  async notFeasible(user: AuthUser, id: string, body: NotFeasibleBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'artisan', "Seul l'artisan de l'intervention peut la déclarer non réalisable.");
    if (b.status !== 'en_route' && b.status !== 'arrived' && b.status !== 'in_progress') {
      throw conflict('invalid_transition', "L'intervention ne peut être déclarée non réalisable qu'une fois en route, sur place ou en cours.");
    }
    await this.filesService.assertOwned(user.id, body.photoFileIds, ['report_before', 'problem_photo']);
    let rescheduled: BookingRow | null = null;
    if (body.action === 'reschedule') {
      const at = new Date(body.rescheduleAt!);
      if (at.getTime() <= Date.now()) throw badRequest('invalid_reschedule', 'Choisissez une date à venir.');
      rescheduled = await this.createRescheduled(b, at, user.id);
    }
    try {
      if (b.status === 'en_route') await this.state.transition(b.id, 'arrived', 'artisan', user.id, { note: 'Arrivé sur place', silent: true });
      await this.state.transition(b.id, 'awaiting_code', 'artisan', user.id, {
        note: `Intervention non réalisable : ${NOT_FEASIBLE_REASON_LABELS[body.reason]}`,
        silent: true,
        guard: (row) => {
          if (row.status !== 'arrived' && row.status !== 'in_progress') {
            throw conflict('invalid_transition', "L'intervention ne peut être déclarée non réalisable qu'une fois sur place.");
          }
        },
        patch: { travelOnly: true },
        inTx: async (tx, row) => {
          const values = {
            feasible: false,
            notFeasibleReason: body.reason,
            notes: body.comment ?? null,
            beforeFileIds: body.photoFileIds,
            afterFileIds: [],
            materials: null,
            voiceFileId: null,
            followUpNeeded: !!rescheduled,
            rescheduledBookingId: rescheduled?.id ?? null,
          };
          await tx.insert(interventionReports).values({ bookingId: row.id, ...values }).onConflictDoUpdate({ target: interventionReports.bookingId, set: values });
        },
      });
    } catch (e) {
      // L'intervention d'origine n'a pas changé : on retire le report proposé (et on lui rend son crédit).
      if (rescheduled) {
        await this.conn.db.update(referralCredits).set({ usedBookingId: b.id }).where(eq(referralCredits.usedBookingId, rescheduled.id));
        await this.conn.db.delete(bookings).where(eq(bookings.id, rescheduled.id));
      }
      throw e;
    }
    await this.jobs.add('bookings', 'auto-capture', { bookingId: b.id }, { delayMs: hours(RULES.completionCode.autoCaptureAfterHours), jobId: `autocapture-${b.id}` });
    // Déplacement seul : la réduction parrainage n'est pas consommée (reportée sur le nouveau RDV le cas échéant).
    if (!rescheduled) await this.referral.release(b.id);

    const [a] = await this.conn.db.select({ name: artisanProfiles.displayName }).from(artisanProfiles).where(eq(artisanProfiles.id, viewer.artisanId!));
    const name = a?.name ?? "L'artisan";
    await this.notifications.notify(b.clientId, {
      type: 'booking_status',
      title: 'Intervention non réalisable',
      body: `${name} n'a pas pu réaliser l'intervention (${NOT_FEASIBLE_REASON_LABELS[body.reason].toLowerCase()}). Seuls les frais de déplacement (${formatEuros(b.travelFeeCents)}) vous seront facturés. Un souci ? Signalez-le depuis l'intervention.`,
      link: DEEP_LINKS.intervention(b.id),
      data: { bookingId: b.id, status: 'awaiting_code', notFeasible: body.reason },
    });
    if (rescheduled) {
      await this.notifications.notify(b.clientId, {
        type: 'booking_status',
        title: 'Nouveau rendez-vous proposé',
        body: `${name} vous propose de revenir le ${formatParis(rescheduled.scheduledAt!)}. Validez ce rendez-vous pour le confirmer.`,
        link: DEEP_LINKS.intervention(rescheduled.id),
        data: { bookingId: rescheduled.id, status: rescheduled.status, rescheduledFromId: b.id },
      });
      await this.onRequested(rescheduled, rescheduled.createdAt);
    }
    return this.mapper.toDetail(await this.load(b.id), viewer);
  }

  /** Nouveau RDV proposé par l'artisan (déjà accepté par lui) : le client le confirme en validant le paiement. */
  private async createRescheduled(b: BookingRow, scheduledAt: Date, artisanUserId: string): Promise<BookingRow> {
    const durationMs = b.scheduledAt && b.endsAt ? b.endsAt.getTime() - b.scheduledAt.getTime() : minutes(await this.slots.durationFor(b.artisanId!, b.serviceId));
    const credit = await this.referral.creditFor(b.id);
    const price = computePrice({ basePriceCents: b.basePriceCents, travelFeeCents: b.travelFeeCents, urgent: false, withGuarantee: false, discountCents: credit });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.conn.db.transaction(async (tx) => {
          const [nb] = await tx
            .insert(bookings)
            .values({
              reference: bookingReference(),
              kind: 'scheduled',
              status: 'pending_payment',
              clientId: b.clientId,
              artisanId: b.artisanId,
              domain: b.domain,
              serviceId: b.serviceId,
              scheduledType: b.scheduledType ?? 'repair',
              addressId: b.addressId,
              problemReason: b.problemReason,
              problemDescription: b.problemDescription,
              problemFileIds: b.problemFileIds,
              scheduledAt,
              endsAt: new Date(scheduledAt.getTime() + durationMs),
              basePriceCents: price.baseCents,
              travelFeeCents: price.travelFeeCents,
              discountCents: price.discountCents,
              totalCents: price.totalCents,
              commissionRate: b.commissionRate,
              priceOnRequest: b.priceOnRequest,
              artisanAcceptedAt: new Date(),
              rescheduledFromId: b.id,
              zoneId: b.zoneId,
            })
            .returning();
          await this.state.logCreation(tx, nb!.id, artisanUserId, { status: 'pending_payment', actor: 'artisan', note: `Report de ${b.reference}` });
          // Le crédit parrainage suit l'intervention reportée.
          await tx.update(referralCredits).set({ usedBookingId: nb!.id }).where(eq(referralCredits.usedBookingId, b.id));
          await this.ensureConversationTx(tx, nb!);
          return nb!;
        });
      } catch (e) {
        const code = pgCode(e);
        if (code === '23P01') throw conflict('slot_unavailable', "Ce créneau n'est pas libre dans votre planning.");
        if (code === '23505' && String((e as { cause?: { constraint_name?: string } }).cause?.constraint_name ?? e).includes('reference')) continue;
        throw e;
      }
    }
    throw new Error('Impossible de générer une référence unique');
  }

  /* ------------------------------------------------------------------ */
  /* Listes                                                             */
  /* ------------------------------------------------------------------ */

  async list(user: AuthUser, q: BookingListQuery): Promise<Paginated<BookingSummaryDto>> {
    let ownerCond;
    let viewer: Viewer;
    if (q.as === 'artisan') {
      const a = await this.artisanOf(user.id);
      if (!a) throw forbidden('artisan_profile_required', 'Un profil artisan est requis.');
      // Paiements en attente invisibles pour l'artisan, sauf ce qu'il a lui-même proposé (prix, report).
      ownerCond = and(eq(bookings.artisanId, a.id), or(notInArray(bookings.status, ['pending_payment']), isNotNull(bookings.artisanAcceptedAt)));
      viewer = { userId: user.id, actor: 'artisan', artisanId: a.id };
    } else {
      ownerCond = eq(bookings.clientId, user.id);
      viewer = { userId: user.id, actor: 'client' };
    }
    const scopeCond =
      q.scope === 'active'
        ? or(
            inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES, 'disputed']),
            // Prix ou report proposé par l'artisan, en attente de validation du client.
            and(eq(bookings.status, 'pending_payment'), or(isNotNull(bookings.artisanAcceptedAt), eq(bookings.priceOnRequest, true))),
          )
        : q.scope === 'past'
          ? inArray(bookings.status, [...TERMINAL_BOOKING_STATUSES])
          : undefined;
    const when = sql`coalesce(${bookings.scheduledAt}, ${bookings.createdAt})`;
    const c = decodeTimeCursor(q.cursor);
    const rows = await this.conn.db
      .select()
      .from(bookings)
      .where(
        and(
          ownerCond,
          scopeCond,
          q.from ? sql`${when} >= ${q.from}::timestamptz` : undefined,
          q.to ? sql`${when} <= ${q.to}::timestamptz` : undefined,
          c ? or(lt(bookings.createdAt, c.at), and(eq(bookings.createdAt, c.at), lt(bookings.id, c.id))) : undefined,
        ),
      )
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(q.limit + 1);
    const items = rows.slice(0, q.limit);
    const last = items[items.length - 1];
    return { items: await this.mapper.toSummaries(items, viewer), nextCursor: rows.length > q.limit && last ? encodeTimeCursor(last.createdAt, last.id) : null };
  }

  /* ------------------------------------------------------------------ */
  /* Transitions simples (en route, arrivé)                             */
  /* ------------------------------------------------------------------ */

  async requestTransition(user: AuthUser, id: string, body: TransitionBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.viewerFor(user, b, { allowOffered: false, allowStaff: false });
    if (!['en_route', 'arrived'].includes(body.to)) {
      throw badRequest('use_dedicated_endpoint', 'Utilisez l’action dédiée (devis, compte rendu, code de fin, annulation, litige).');
    }
    let etaAt: Date | undefined;
    if (body.to === 'en_route' && body.lat != null && body.lng != null) {
      const [addr] = await this.conn.db.select().from(addresses).where(eq(addresses.id, b.addressId));
      if (addr) etaAt = new Date(Date.now() + minutes(naiveEtaMinutes(distanceKm({ lat: body.lat, lng: body.lng }, addr))));
    }
    const updated = await this.state.transition(b.id, body.to, viewer.actor, user.id, {
      lat: body.lat,
      lng: body.lng,
      note: body.note,
      patch: etaAt ? { etaAt } : {},
    });
    if (viewer.artisanId && body.lat != null && body.lng != null) {
      await this.conn.db.update(artisanProfiles).set({ currentLat: body.lat, currentLng: body.lng, currentLocationAt: new Date() }).where(eq(artisanProfiles.id, viewer.artisanId));
    }
    return this.mapper.toDetail(updated, viewer);
  }

  /* ------------------------------------------------------------------ */
  /* Annulation                                                         */
  /* ------------------------------------------------------------------ */

  async cancel(user: AuthUser, id: string, body: CancelBookingBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.viewerFor(user, b, { allowOffered: false, allowStaff: false });
    const to = viewer.actor === 'client' ? 'cancelled_by_client' : 'cancelled_by_artisan';
    let previous: BookingStatus = b.status as BookingStatus;
    let feeCents = 0;
    const updated = await this.state.transition(b.id, to, viewer.actor, user.id, {
      note: body.reason,
      guard: (row) => {
        previous = row.status as BookingStatus;
      },
      patch: (row) => {
        feeCents = viewer.actor === 'client' ? clientCancellationTerms(row).feeCents : 0;
        return { cancellationFeeCents: feeCents, cancellationReason: body.reason ?? null };
      },
    });
    if (previous === 'searching') await this.dispatch.cancelPendingOffers(b.id);
    if (feeCents > 0) {
      // Frais de déplacement seuls : jamais de commission.
      const captured = await this.payments.capture(updated, feeCents, computeCommission({ capturedCents: feeCents, travelOnly: true, commissionRate: updated.commissionRate }));
      await this.conn.db.update(bookings).set({ capturedCents: captured, commissionCents: 0 }).where(eq(bookings.id, b.id));
      if (captured > 0) await this.jobs.add('invoices', 'generate', { bookingId: b.id }, { jobId: `invoice-${b.id}` });
    } else {
      await this.payments.releaseAll(b.id);
    }
    if (viewer.actor === 'artisan' && viewer.artisanId) await this.reliability.onArtisanCancellation(viewer.artisanId);
    return this.mapper.toDetail(await this.load(b.id), viewer);
  }

  /* ------------------------------------------------------------------ */
  /* Devis                                                              */
  /* ------------------------------------------------------------------ */

  async sendQuote(user: AuthUser, id: string, body: CreateQuoteBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'artisan', "Seul l'artisan de l'intervention peut envoyer un devis.");
    const lines = body.lines.map((l, i) => ({ ...l, totalCents: Math.round(l.quantity * l.unitPriceCents), position: i }));
    const totalCents = lines.reduce((s, l) => s + l.totalCents, 0);
    let quoteId = '';
    const expiresAt = new Date(Date.now() + minutes(QUOTE_TTL_MINUTES));
    const updated = await this.state.transition(b.id, 'quote_pending', 'artisan', user.id, {
      inTx: async (tx, row) => {
        await tx.update(quotes).set({ status: 'expired' }).where(and(eq(quotes.bookingId, row.id), eq(quotes.status, 'sent')));
        const [q] = await tx
          .insert(quotes)
          .values({
            bookingId: row.id,
            artisanId: viewer.artisanId!,
            totalCents,
            needsNewAuthorization: quoteNeedsNewAuthorization(totalCents, row.authorizedCents),
            keepReplacedParts: body.keepReplacedParts,
            expiresAt,
          })
          .returning();
        quoteId = q!.id;
        await tx.insert(quoteLines).values(lines.map((l) => ({ quoteId: q!.id, kind: l.kind, label: l.label, quantity: l.quantity, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents, position: l.position })));
      },
    });
    await this.jobs.add('bookings', 'quote-expire', { bookingId: b.id, quoteId }, { delayMs: minutes(QUOTE_TTL_MINUTES), jobId: `quote-${quoteId}` });
    return this.mapper.toDetail(updated, viewer);
  }

  async answerQuote(user: AuthUser, id: string, body: AnswerQuoteBody): Promise<{ booking: BookingDetailDto; payment: PaymentSessionDto | null }> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'client', 'Seul le client peut répondre au devis.');
    const [quote] = await this.conn.db.select().from(quotes).where(and(eq(quotes.bookingId, b.id), eq(quotes.status, 'sent'))).orderBy(desc(quotes.createdAt)).limit(1);
    if (!quote) throw conflict('no_pending_quote', 'Aucun devis en attente de réponse.');
    if (quote.expiresAt < new Date()) throw gone('quote_expired', "Ce devis a expiré. Demandez à l'artisan de le renvoyer.");
    let payment: PaymentSessionDto | null = null;
    let updated: BookingRow;
    // La réduction parrainage s'applique aussi au devis.
    const netQuote = Math.max(0, quote.totalCents - b.discountCents);
    if (body.accept) {
      updated = await this.state.transition(b.id, 'in_progress', 'client', user.id, {
        inTx: async (tx) => {
          await tx.update(quotes).set({ status: 'accepted', answeredAt: new Date() }).where(eq(quotes.id, quote.id));
        },
        patch: { totalCents: netQuote },
      });
      const extra = netQuote - b.authorizedCents;
      if (extra > 0) {
        if (quoteNeedsNewAuthorization(netQuote, b.authorizedCents)) {
          // Dépassement > 20 % : le client valide une autorisation complémentaire dans l'app.
          payment = await this.payments.createSupplement(updated, extra);
        } else {
          // Dans la fourchette annoncée : complément autorisé hors session sur la carte enregistrée.
          await this.payments.createSupplement(updated, extra, { offSession: true }).catch((e) => this.logger.warn(`complément hors session ${b.reference} : ${e}`));
        }
        updated = await this.load(b.id);
      }
    } else {
      updated = await this.state.transition(b.id, 'arrived', 'client', user.id, {
        note: 'Devis refusé',
        inTx: async (tx) => {
          await tx.update(quotes).set({ status: 'refused', answeredAt: new Date() }).where(eq(quotes.id, quote.id));
        },
      });
    }
    await this.jobs.remove('bookings', `quote-${quote.id}`);
    return { booking: await this.mapper.toDetail(updated, viewer), payment };
  }

  /** Job quote-expire : devis sans réponse au bout de 30 min. */
  async expireQuote(bookingId: string, quoteId: string) {
    const [q] = await this.conn.db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!q || q.status !== 'sent') return { skipped: true };
    const b = await this.load(bookingId);
    if (b.status !== 'quote_pending') {
      await this.conn.db.update(quotes).set({ status: 'expired' }).where(eq(quotes.id, quoteId));
      return { skipped: true };
    }
    await this.state.transition(b.id, 'arrived', 'system', null, {
      note: 'Devis expiré',
      inTx: async (tx) => {
        await tx.update(quotes).set({ status: 'expired' }).where(and(eq(quotes.id, quoteId), eq(quotes.status, 'sent')));
      },
    });
    return { expired: true };
  }

  /* ------------------------------------------------------------------ */
  /* Compte rendu, code de fin, capture                                 */
  /* ------------------------------------------------------------------ */

  async report(user: AuthUser, id: string, body: ReportBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'artisan', "Seul l'artisan de l'intervention peut envoyer le compte rendu.");
    await this.filesService.assertOwned(user.id, body.beforeFileIds, ['report_before', 'problem_photo']);
    await this.filesService.assertOwned(user.id, body.afterFileIds, ['report_after', 'problem_photo']);
    await this.filesService.assertOwned(user.id, [body.voiceFileId], ['problem_voice']);
    const updated = await this.state.transition(b.id, 'awaiting_code', 'artisan', user.id, {
      guard: (row) => {
        if (body.travelOnly && row.status !== 'arrived') throw conflict('invalid_transition', '« Déplacement seulement » n’est possible qu’avant tout devis accepté.');
        if (!body.travelOnly && row.status !== 'in_progress') throw conflict('invalid_transition', 'Les travaux doivent être en cours pour envoyer le compte rendu.');
      },
      patch: { travelOnly: body.travelOnly },
      inTx: async (tx, row) => {
        const values = {
          feasible: body.feasible,
          materials: body.materials ?? null,
          notes: body.notes ?? null,
          voiceFileId: body.voiceFileId ?? null,
          followUpNeeded: body.followUpNeeded,
          beforeFileIds: body.beforeFileIds,
          afterFileIds: body.afterFileIds,
        };
        await tx.insert(interventionReports).values({ bookingId: row.id, ...values }).onConflictDoUpdate({ target: interventionReports.bookingId, set: values });
      },
    });
    await this.jobs.add('bookings', 'auto-capture', { bookingId: b.id }, { delayMs: hours(RULES.completionCode.autoCaptureAfterHours), jobId: `autocapture-${b.id}` });
    return this.mapper.toDetail(updated, viewer);
  }

  async complete(user: AuthUser, id: string, code: string): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'artisan', "Seul l'artisan de l'intervention peut saisir le code de fin.");
    const max = RULES.completionCode.maxAttempts;
    const check = await this.conn.db.transaction(async (tx) => {
      const [row] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update');
      if (row!.status !== 'awaiting_code') throw conflict('invalid_transition', "Le code de fin n'est pas attendu à ce stade.");
      if (row!.completionAttempts >= max) return { ok: false, attempts: row!.completionAttempts, lockedNow: false };
      if (this.codes.verify(row!.id, code, row!.completionCodeHash)) return { ok: true, attempts: row!.completionAttempts, lockedNow: false };
      const attempts = row!.completionAttempts + 1;
      await tx.update(bookings).set({ completionAttempts: attempts }).where(eq(bookings.id, id));
      return { ok: false, attempts, lockedNow: attempts >= max };
    });
    if (!check.ok) {
      if (check.lockedNow) {
        await this.audit.log(null, 'completion_code_locked', 'booking', b.id, { reference: b.reference, artisanUserId: user.id });
        await this.notifications.notifySupport({
          type: 'booking_status',
          title: 'Code de fin bloqué',
          body: `Intervention ${b.reference} : 3 codes erronés saisis. Vérification nécessaire.`,
          link: DEEP_LINKS.intervention(b.id),
          data: { bookingId: b.id, alert: 'completion_code_locked' },
        });
      }
      if (check.attempts >= max) {
        throw locked('code_locked', 'Code bloqué après 3 essais. Le support DEPANO a été alerté et va vous contacter.', { attemptsLeft: 0 } satisfies CompletionCodeErrorDetails);
      }
      const left = max - check.attempts;
      throw badRequest('code_invalid', `Code incorrect. Il vous reste ${left} essai${left > 1 ? 's' : ''}.`, { attemptsLeft: left } satisfies CompletionCodeErrorDetails);
    }
    const closed = await this.state.transition(b.id, 'closed', 'artisan', user.id, { note: 'Code de fin validé' });
    await this.finalizeClosure(closed);
    return this.mapper.toDetail(await this.load(b.id), viewer);
  }

  /** Capture (montant du devis accepté ou autorisé), commission, facture, compteurs. */
  async finalizeClosure(b: BookingRow, opts: { amountCents?: number; travelOnly?: boolean } = {}) {
    const [accepted] = await this.conn.db
      .select({ total: quotes.totalCents })
      .from(quotes)
      .where(and(eq(quotes.bookingId, b.id), eq(quotes.status, 'accepted')))
      .orderBy(desc(quotes.createdAt))
      .limit(1);
    const capturable = (await this.payments.capturable(b.id)).reduce((s, p) => s + p.amountCents, 0);
    const target = Math.min(opts.amountCents ?? closingAmount(b, accepted?.total ?? null), capturable);
    const travelOnly = opts.travelOnly ?? b.travelOnly;
    // Réduction parrainage financée par DEPANO : commission calculée sur le montant avant réduction, diminuée de la
    // réduction (l'artisan touche son net habituel tant que la réduction ne dépasse pas la commission).
    const discount = travelOnly ? 0 : b.discountCents;
    const fee = Math.max(0, computeCommission({ capturedCents: target + discount, travelOnly, commissionRate: b.commissionRate }) - discount);
    let captured = 0;
    try {
      captured = await this.payments.capture(b, target, fee);
    } catch (e) {
      this.logger.error(`capture impossible ${b.reference} : ${e}`);
      await this.notifications.notifySupport({
        type: 'booking_status',
        title: 'Échec de capture',
        body: `Intervention ${b.reference} : la capture du paiement a échoué.`,
        link: DEEP_LINKS.intervention(b.id),
        data: { bookingId: b.id, alert: 'capture_failed' },
      });
    }
    await this.conn.db.update(bookings).set({ capturedCents: captured, commissionCents: captured ? fee : 0 }).where(eq(bookings.id, b.id));
    if (b.artisanId) {
      await this.conn.db.update(artisanProfiles).set({ completedCount: sql`${artisanProfiles.completedCount} + 1` }).where(eq(artisanProfiles.id, b.artisanId));
    }
    // Déplacement seul : la réduction n'a pas servi, le crédit redevient disponible.
    if (travelOnly) await this.referral.release(b.id);
    if (captured > 0) await this.jobs.add('invoices', 'generate', { bookingId: b.id }, { jobId: `invoice-${b.id}` });
    return { captured, commission: captured ? fee : 0 };
  }

  /** Job auto-capture : pas de code au bout de 24 h, sauf litige. */
  async autoCapture(bookingId: string) {
    const b = await this.load(bookingId);
    if (b.status !== 'awaiting_code') return { skipped: true, status: b.status };
    const [d] = await this.conn.db.select({ id: disputes.id }).from(disputes).where(and(eq(disputes.bookingId, b.id), eq(disputes.status, 'open')));
    if (d) return { skipped: true, status: 'disputed' };
    const closed = await this.state.transition(b.id, 'closed', 'system', null, { note: 'Capture automatique (24 h sans code)' });
    return this.finalizeClosure(closed);
  }

  /* ------------------------------------------------------------------ */
  /* Jobs planifiés                                                     */
  /* ------------------------------------------------------------------ */

  async reminder(bookingId: string, kind: 'day_before' | 'hour_before') {
    const b = await this.load(bookingId);
    if (b.status !== 'accepted' || !b.scheduledAt || !b.artisanId) return { skipped: true };
    const [a] = await this.conn.db.select({ userId: artisanProfiles.userId, name: artisanProfiles.displayName }).from(artisanProfiles).where(eq(artisanProfiles.id, b.artisanId));
    const when = formatParis(b.scheduledAt, { timeStyle: 'short' });
    const title = kind === 'day_before' ? 'Rappel : intervention demain' : 'Rappel : intervention dans 1 heure';
    const link = DEEP_LINKS.intervention(b.id);
    await this.notifications.notify(b.clientId, { type: 'reminder', title, body: `${a?.name ?? "L'artisan"} intervient à ${when}.`, link, data: { bookingId: b.id, kind } });
    if (a) await this.notifications.notify(a.userId, { type: 'reminder', title, body: `${b.problemReason} à ${when}.`, link, data: { bookingId: b.id, kind } });
    return { sent: true };
  }

  async authorizeScheduled(bookingId: string) {
    const b = await this.load(bookingId);
    if (b.status !== 'accepted' || b.kind !== 'scheduled') return { skipped: true };
    const r = await this.payments.authorizeScheduled(b);
    if (!r.authorized) {
      await this.notifications.notify(b.clientId, {
        type: 'booking_status',
        title: 'Paiement à mettre à jour',
        body: "Nous n'avons pas pu valider l'empreinte bancaire de votre rendez-vous. Mettez à jour votre carte.",
        link: DEEP_LINKS.intervention(b.id),
        data: { bookingId: b.id },
      });
    }
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Position, avis, litige, appel                                      */
  /* ------------------------------------------------------------------ */

  async updateLocation(user: Pick<AuthUser, 'id' | 'roles'>, id: string, body: LocationBody) {
    const b = await this.load(id);
    const artisan = await this.artisanOf(user.id);
    if (!artisan || b.artisanId !== artisan.id) throw forbidden('booking_forbidden', "Seul l'artisan de l'intervention partage sa position.");
    if (!LOCATION_STATUSES.includes(b.status as BookingStatus)) throw conflict('location_not_allowed', "Le partage de position n'est pas actif pour cette intervention.");
    const now = new Date();
    await this.conn.db.insert(bookingLocations).values({ bookingId: b.id, lat: body.lat, lng: body.lng, heading: body.heading ?? null, speed: body.speed ?? null });
    await this.conn.db.update(artisanProfiles).set({ currentLat: body.lat, currentLng: body.lng, currentLocationAt: now }).where(eq(artisanProfiles.id, artisan.id));
    const [addr] = await this.conn.db.select({ lat: addresses.lat, lng: addresses.lng }).from(addresses).where(eq(addresses.id, b.addressId));
    const etaMinutes = addr && ['accepted', 'en_route'].includes(b.status) ? naiveEtaMinutes(distanceKm(body, addr)) : null;
    if (etaMinutes != null && b.status === 'en_route') {
      await this.conn.db.update(bookings).set({ etaAt: new Date(now.getTime() + minutes(etaMinutes)) }).where(eq(bookings.id, b.id));
    }
    this.realtime.emitToBooking(
      b.id,
      'booking.location',
      { bookingId: b.id, lat: body.lat, lng: body.lng, heading: body.heading ?? null, etaMinutes, at: now.toISOString() },
      [b.clientId],
    );
  }

  async review(user: AuthUser, id: string, body: ReviewBody): Promise<ReviewDto> {
    return this.reviewsService.create(await this.load(id), user.id, body);
  }

  async dispute(user: AuthUser, id: string, body: DisputeBody): Promise<BookingDetailDto> {
    const b = await this.load(id);
    const viewer = await this.requireActor(user, b, 'client', 'Seul le client peut ouvrir un litige.');
    let previous: BookingStatus = b.status as BookingStatus;
    const updated = await this.state.transition(b.id, 'disputed', 'client', user.id, {
      note: body.reason,
      guard: (row) => {
        previous = row.status as BookingStatus;
        // RDV à venir : pas de litige « technicien jamais venu » avant l'heure prévue.
        const blocked = clientDisputeBlockedReason({ status: row.status as BookingStatus, scheduledAt: row.scheduledAt });
        if (blocked) throw conflict('dispute_too_early', blocked);
      },
      inTx: async (tx, row) => {
        await tx
          .insert(disputes)
          .values({ bookingId: row.id, openedBy: user.id, reason: body.reason, description: body.description ?? null, previousStatus: previous, dueAt: new Date(Date.now() + hours(72)) })
          .onConflictDoUpdate({
            target: disputes.bookingId,
            set: { reason: body.reason, description: body.description ?? null, previousStatus: previous, status: 'open', resolution: null, resolvedAt: null, dueAt: new Date(Date.now() + hours(72)) },
          });
      },
    });
    await this.notifications.notifySupport({
      type: 'booking_status',
      title: 'Nouveau litige',
      body: `Intervention ${b.reference} : ${body.reason}. À traiter sous 72 h.`,
      link: DEEP_LINKS.intervention(b.id),
      data: { bookingId: b.id, alert: 'dispute_opened' },
      push: false,
    });
    return this.mapper.toDetail(updated, viewer);
  }

  async callRelay(user: AuthUser, id: string): Promise<CallRelayDto> {
    const b = await this.load(id);
    const viewer = await this.viewerFor(user, b, { allowOffered: false, allowStaff: false });
    if (!CALLABLE.includes(b.status as BookingStatus) || !b.artisanId) throw conflict('call_unavailable', "L'appel n'est disponible que pendant l'intervention.");
    await this.limiter.hit(`call:${user.id}:${b.id}`, 10, 3600, "Trop d'appels, réessayez plus tard.");
    const [a] = await this.conn.db.select({ phone: users.phone }).from(artisanProfiles).innerJoin(users, eq(users.id, artisanProfiles.userId)).where(eq(artisanProfiles.id, b.artisanId));
    const [c] = await this.conn.db.select({ phone: users.phone }).from(users).where(eq(users.id, b.clientId));
    const caller = viewer.actor === 'client' ? c?.phone : a?.phone;
    const callee = viewer.actor === 'client' ? a?.phone : c?.phone;
    if (!caller || !callee) throw conflict('call_unavailable', 'Numéro de téléphone indisponible.');
    const ttlSeconds = 2 * 3600;
    const r = await this.relay.createRelay({ bookingId: b.id, callerPhone: caller, calleePhone: callee, ttlSeconds });
    return { phoneNumber: r.phoneNumber, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
  }
}
