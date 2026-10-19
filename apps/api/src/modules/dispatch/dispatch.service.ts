import { Inject, Injectable, Logger } from '@nestjs/common';
import { DEEP_LINKS, RULES, type BookingDetailDto, type DomainCode, type UrgentOfferDto } from '@depano/schemas';
import { addresses, and, artisanProfiles, bookings, dispatchOffers, eq, gt, inArray, ne, sql, users } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { JobsService } from '../../infra/jobs';
import { RealtimeService } from '../../infra/realtime';
import { BookingStateService, type BookingRow } from '../bookings/booking-state.service';
import { BookingMapper } from '../bookings/booking-mapper.service';
import { CompletionCodeService } from '../bookings/completion-code.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { ChatService } from '../chat/chat.service';
import { SlotsService } from '../catalog/slots.service';
import { AppError, conflict, forbidden, gone, notFound } from '../../common/errors';
import { formatParis, naiveEtaMinutes } from '../../common/time';

type OfferRow = typeof dispatchOffers.$inferSelect;

/**
 * Dispatch des urgences par vagues (5, 10 puis 20 km ; 3 artisans ; 60 s).
 * Piloté par les workers (jobs start / wave-timeout) ; l'acceptation est protégée par le verrou de ligne.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger('Dispatch');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(BookingStateService) private readonly state: BookingStateService,
    @Inject(BookingMapper) private readonly mapper: BookingMapper,
    @Inject(CompletionCodeService) private readonly codes: CompletionCodeService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(SlotsService) private readonly slots: SlotsService,
  ) {}

  private async booking(id: string) {
    const [b] = await this.conn.db.select().from(bookings).where(eq(bookings.id, id));
    return b ?? null;
  }

  /** Job « start » : première vague. */
  async start(bookingId: string) {
    const b = await this.booking(bookingId);
    if (!b || b.status !== 'searching' || b.dispatchWave > 0) return { skipped: true };
    await this.conn.db.update(bookings).set({ dispatchStartedAt: b.dispatchStartedAt ?? new Date() }).where(eq(bookings.id, b.id));
    return this.runWave(b, 1);
  }

  private async runWave(b: BookingRow, wave: number): Promise<{ wave: number; contacted: number }> {
    const radiusKm = RULES.dispatch.radiiKm[wave - 1]!;
    const [addr] = await this.conn.db.select().from(addresses).where(eq(addresses.id, b.addressId));
    const candidates = await this.conn.db.execute<{ artisan_id: string; user_id: string; distance_km: number }>(
      sql`select * from find_dispatch_candidates(${b.id}::uuid, ${b.domain}::domain_code, ${addr!.lat}, ${addr!.lng}, ${radiusKm}, ${RULES.dispatch.artisansPerWave})`,
    );
    const expiresAt = new Date(Date.now() + RULES.dispatch.offerTimeoutSeconds * 1000);
    // Verrou + contrôle d'état : un dispatch concurrent ou une acceptation stoppe la vague.
    const created = await this.conn.db.transaction(async (tx) => {
      const [locked] = await tx.select().from(bookings).where(eq(bookings.id, b.id)).for('update');
      if (!locked || locked.status !== 'searching' || locked.dispatchWave >= wave) return null;
      await tx.update(bookings).set({ dispatchWave: wave }).where(eq(bookings.id, b.id));
      if (!candidates.length) return [] as OfferRow[];
      const rows = await tx
        .insert(dispatchOffers)
        .values(
          candidates.map((c, i) => ({
            bookingId: b.id,
            artisanId: c.artisan_id,
            wave,
            radiusKm,
            distanceKm: Number(c.distance_km),
            rank: i + 1,
            expiresAt,
          })),
        )
        .onConflictDoNothing()
        .returning();
      if (rows.length) {
        await tx
          .update(artisanProfiles)
          .set({ offersReceived: sql`${artisanProfiles.offersReceived} + 1` })
          .where(inArray(artisanProfiles.id, rows.map((r) => r.artisanId)));
      }
      return rows;
    });
    if (created === null) return { wave, contacted: 0 };

    const [{ n: contacted } = { n: 0 }] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dispatchOffers)
      .where(eq(dispatchOffers.bookingId, b.id));
    this.realtime.emitToBooking(b.id, 'booking.dispatch', { bookingId: b.id, wave, contacted, radiusKm }, [b.clientId]);
    const fresh = (await this.booking(b.id))!;
    for (const offer of created) {
      const dto = await this.toOfferDto(offer, fresh, addr!.city);
      const userId = candidates.find((c) => c.artisan_id === offer.artisanId)!.user_id;
      this.realtime.emitToUser(userId, 'offer.created', dto);
      await this.notifications.notify(userId, {
        type: 'urgent_offer',
        title: '🚨 Nouvelle urgence à proximité',
        body: `${b.problemReason} — ${dto.distanceKm.toFixed(1)} km, ${(dto.estimatedEarningsCents / 100).toFixed(0)} € estimés. 60 s pour accepter.`,
        link: DEEP_LINKS.offer(offer.id),
        data: { offerId: offer.id, bookingId: b.id },
      });
    }
    this.logger.log(`vague ${wave} (${radiusKm} km) pour ${b.reference} : ${created.length} artisan(s)`);
    if (!created.length && wave < RULES.dispatch.radiiKm.length) return this.runWave(fresh, wave + 1);
    await this.jobs.add('dispatch', 'wave-timeout', { bookingId: b.id, wave }, { delayMs: RULES.dispatch.offerTimeoutSeconds * 1000, jobId: `wave-${b.id}-${wave}` });
    return { wave, contacted: created.length };
  }

  /** Job « wave-timeout » : expire les offres de la vague, passe à la suivante ou clôt en « expired ». */
  async waveTimeout(bookingId: string, wave: number) {
    const b = await this.booking(bookingId);
    if (!b || b.status !== 'searching' || b.dispatchWave !== wave) return { skipped: true };
    await this.expireOffers(b.id, wave, 'expired');
    if (wave < RULES.dispatch.radiiKm.length) return this.runWave(b, wave + 1);
    return this.expireBooking(b);
  }

  private async expireOffers(bookingId: string, wave: number | null, reason: 'expired' | 'cancelled' | 'taken') {
    const rows = await this.conn.db
      .update(dispatchOffers)
      .set({ status: reason === 'taken' ? 'taken' : 'expired', respondedAt: new Date() })
      .where(and(eq(dispatchOffers.bookingId, bookingId), eq(dispatchOffers.status, 'pending'), wave ? eq(dispatchOffers.wave, wave) : undefined))
      .returning();
    await this.revokeOffers(rows, reason);
    return rows;
  }

  private async revokeOffers(rows: OfferRow[], reason: 'expired' | 'cancelled' | 'taken') {
    if (!rows.length) return;
    const owners = await this.conn.db
      .select({ id: artisanProfiles.id, userId: artisanProfiles.userId })
      .from(artisanProfiles)
      .where(inArray(artisanProfiles.id, rows.map((r) => r.artisanId)));
    const byId = new Map(owners.map((o) => [o.id, o.userId]));
    for (const r of rows) {
      const userId = byId.get(r.artisanId);
      if (userId) this.realtime.emitToUser(userId, 'offer.revoked', { offerId: r.id, bookingId: r.bookingId, reason });
    }
  }

  /** Annulation de l'urgence par le client : retire les offres en cours. */
  async cancelPendingOffers(bookingId: string) {
    return this.expireOffers(bookingId, null, 'cancelled');
  }

  private async expireBooking(b: BookingRow) {
    const updated = await this.state.transition(b.id, 'expired', 'system', null, { note: 'Aucun artisan disponible', silent: true });
    await this.payments.releaseAll(b.id);
    const alt = await this.firstAlternative(updated).catch(() => null);
    await this.notifications.notify(b.clientId, {
      type: 'booking_expired',
      title: 'Aucun artisan disponible',
      body: alt
        ? `Aucun artisan n'a pu accepter votre urgence. Votre empreinte est libérée. Prochain créneau : ${formatParis(new Date(alt.slotAt))} avec ${alt.displayName}.`
        : "Aucun artisan n'a pu accepter votre urgence. Votre empreinte bancaire est libérée.",
      link: alt ? DEEP_LINKS.artisan(alt.artisanId) : DEEP_LINKS.intervention(b.id),
      data: { bookingId: b.id, alternative: alt },
    });
    return { expired: true, alternative: alt };
  }

  /** Premier créneau planifié disponible parmi les artisans du métier couvrant l'adresse. */
  async firstAlternative(b: BookingRow) {
    const [addr] = await this.conn.db.select().from(addresses).where(eq(addresses.id, b.addressId));
    if (!addr) return null;
    const near = await this.conn.db.execute<{ id: string; display_name: string }>(sql`
      select a.id, a.display_name from artisan_profiles a
      where a.status = 'approved' and ${b.domain}::domain_code = any(a.domains) and a.base_location is not null
        and ST_DWithin(a.base_location, ST_SetSRID(ST_MakePoint(${addr.lng}, ${addr.lat}), 4326)::geography, a.radius_km * 1000)
      order by ST_Distance(a.base_location, ST_SetSRID(ST_MakePoint(${addr.lng}, ${addr.lat}), 4326)::geography)
      limit 10`);
    if (!near.length) return null;
    const next = await this.slots.nextSlots(near.map((n) => n.id));
    let best: { artisanId: string; displayName: string; slotAt: string } | null = null;
    for (const n of near) {
      const at = next.get(n.id);
      if (at && (!best || at < best.slotAt)) best = { artisanId: n.id, displayName: n.display_name, slotAt: at };
    }
    return best;
  }

  async toOfferDto(o: OfferRow, b: BookingRow, city?: string): Promise<UrgentOfferDto> {
    if (!city) {
      const [a] = await this.conn.db.select({ city: addresses.city }).from(addresses).where(eq(addresses.id, b.addressId));
      city = a?.city ?? '';
    }
    return {
      id: o.id,
      bookingId: b.id,
      status: o.status,
      domain: b.domain as DomainCode,
      problemReason: b.problemReason,
      problemDescription: b.problemDescription,
      problemPhotoUrls: await this.filesService.signedUrls(b.problemFileIds),
      distanceKm: Math.round(o.distanceKm * 10) / 10,
      city,
      estimatedEarningsCents: b.totalCents - Math.round(b.totalCents * b.commissionRate),
      totalCents: b.totalCents,
      expiresAt: o.expiresAt.toISOString(),
      createdAt: o.createdAt.toISOString(),
    };
  }

  async pendingOffers(artisanId: string): Promise<UrgentOfferDto[]> {
    const rows = await this.conn.db
      .select({ o: dispatchOffers, b: bookings })
      .from(dispatchOffers)
      .innerJoin(bookings, eq(bookings.id, dispatchOffers.bookingId))
      .where(and(eq(dispatchOffers.artisanId, artisanId), eq(dispatchOffers.status, 'pending'), gt(dispatchOffers.expiresAt, new Date()), eq(bookings.status, 'searching')))
      .orderBy(dispatchOffers.expiresAt);
    return Promise.all(rows.map(({ o, b }) => this.toOfferDto(o, b)));
  }

  /**
   * Détail d'une offre de l'artisan, quel que soit son statut (écran plein écran ouvert depuis une notification).
   * Une offre encore « pending » mais échue ou dont l'intervention n'est plus en recherche est présentée comme
   * expirée / prise, sans attendre le job de fin de vague.
   */
  async getOffer(artisanId: string, offerId: string): Promise<UrgentOfferDto> {
    const o = await this.offerFor(artisanId, offerId);
    const [b] = await this.conn.db.select().from(bookings).where(eq(bookings.id, o.bookingId));
    if (!b) throw notFound('offer_not_found', 'Offre introuvable.');
    const dto = await this.toOfferDto(o, b);
    if (dto.status === 'pending') {
      if (b.status !== 'searching') dto.status = b.artisanId && b.artisanId !== artisanId ? 'taken' : 'expired';
      else if (o.expiresAt <= new Date()) dto.status = 'expired';
    }
    return dto;
  }

  private async offerFor(artisanId: string, offerId: string) {
    const [o] = await this.conn.db.select().from(dispatchOffers).where(eq(dispatchOffers.id, offerId));
    if (!o) throw notFound('offer_not_found', 'Offre introuvable.');
    if (o.artisanId !== artisanId) throw forbidden('offer_forbidden', "Cette offre ne vous est pas destinée.");
    return o;
  }

  /** Acceptation : la première gagne (verrou FOR UPDATE sur l'intervention), les autres reçoivent offer.revoked. */
  async accept(artisan: { id: string; userId: string }, offerId: string): Promise<BookingDetailDto> {
    const offer = await this.offerFor(artisan.id, offerId);
    if (offer.status === 'taken') throw conflict('offer_taken', 'Un autre artisan a déjà accepté cette demande.');
    if (offer.status !== 'pending') throw gone('offer_expired', "Cette offre n'est plus disponible.");
    if (offer.expiresAt < new Date()) throw gone('offer_expired', 'Le délai pour accepter cette offre est écoulé.');
    const [profile] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.id, artisan.id));
    let taken: OfferRow[] = [];
    let b: BookingRow;
    try {
      b = await this.state.transition(offer.bookingId, 'accepted', 'artisan', artisan.userId, {
        lat: profile?.currentLat,
        lng: profile?.currentLng,
        guard: (row) => {
          if (row.status !== 'searching') throw conflict('offer_taken', 'Un autre artisan a déjà accepté cette demande.');
        },
        patch: (row) => ({
          artisanId: artisan.id,
          ...this.codes.generate(row.id),
          etaAt: new Date(Date.now() + (naiveEtaMinutes(offer.distanceKm) + 5) * 60_000),
        }),
        inTx: async (tx, row) => {
          const [mine] = await tx
            .update(dispatchOffers)
            .set({ status: 'accepted', respondedAt: new Date() })
            .where(and(eq(dispatchOffers.id, offer.id), eq(dispatchOffers.status, 'pending')))
            .returning();
          if (!mine) throw gone('offer_expired', "Cette offre n'est plus disponible.");
          taken = await tx
            .update(dispatchOffers)
            .set({ status: 'taken', respondedAt: new Date() })
            .where(and(eq(dispatchOffers.bookingId, row.id), eq(dispatchOffers.status, 'pending'), ne(dispatchOffers.id, offer.id)))
            .returning();
          await tx.update(artisanProfiles).set({ offersAccepted: sql`${artisanProfiles.offersAccepted} + 1` }).where(eq(artisanProfiles.id, artisan.id));
          await this.chat.ensureConversation(tx, row.id, row.clientId, artisan.userId);
        },
      });
    } catch (e) {
      if (e instanceof AppError && (e.code === 'offer_taken' || e.code === 'invalid_transition')) {
        await this.conn.db.update(dispatchOffers).set({ status: 'taken', respondedAt: new Date() }).where(and(eq(dispatchOffers.id, offer.id), eq(dispatchOffers.status, 'pending')));
        throw conflict('offer_taken', 'Un autre artisan a déjà accepté cette demande.');
      }
      throw e;
    }
    await this.revokeOffers(taken, 'taken');
    await this.jobs.remove('dispatch', `wave-${b.id}-${b.dispatchWave}`);
    return this.mapper.toDetail(b, { userId: artisan.userId, actor: 'artisan', artisanId: artisan.id });
  }

  async decline(artisan: { id: string; userId: string }, offerId: string) {
    const offer = await this.offerFor(artisan.id, offerId);
    if (offer.status !== 'pending') return;
    await this.conn.db.update(dispatchOffers).set({ status: 'declined', respondedAt: new Date() }).where(eq(dispatchOffers.id, offer.id));
    // Tous les artisans de la vague ont répondu : on n'attend pas la fin des 60 s.
    const [left] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.bookingId, offer.bookingId), eq(dispatchOffers.wave, offer.wave), eq(dispatchOffers.status, 'pending')));
    if ((left?.n ?? 0) === 0) {
      await this.jobs.add('dispatch', 'wave-timeout', { bookingId: offer.bookingId, wave: offer.wave }, { jobId: `wave-${offer.bookingId}-${offer.wave}-declined` });
    }
  }

  /** Artisans ayant reçu une offre pour l'intervention (accès en lecture limitée). */
  async hasOffer(bookingId: string, artisanId: string) {
    const [o] = await this.conn.db
      .select({ id: dispatchOffers.id })
      .from(dispatchOffers)
      .where(and(eq(dispatchOffers.bookingId, bookingId), eq(dispatchOffers.artisanId, artisanId)));
    return !!o;
  }

  async offersForAdmin(bookingId: string) {
    return this.conn.db
      .select({ o: dispatchOffers, name: artisanProfiles.displayName, phone: users.phone })
      .from(dispatchOffers)
      .innerJoin(artisanProfiles, eq(artisanProfiles.id, dispatchOffers.artisanId))
      .innerJoin(users, eq(users.id, artisanProfiles.userId))
      .where(eq(dispatchOffers.bookingId, bookingId))
      .orderBy(dispatchOffers.wave, dispatchOffers.rank);
  }
}
