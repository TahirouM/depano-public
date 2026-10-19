import { Inject, Injectable, Logger } from '@nestjs/common';
import { DEEP_LINKS, findTransition, type Actor, type BookingStatus } from '@depano/schemas';
import { artisanProfiles, bookingEvents, bookings, eq, type Tx } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { RealtimeService } from '../../infra/realtime';
import { NotificationsService, type NotifyInput } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { conflict, notFound } from '../../common/errors';
import { formatParis } from '../../common/time';

export type BookingRow = typeof bookings.$inferSelect;
export type BookingPatch = Partial<Omit<typeof bookings.$inferInsert, 'id' | 'status' | 'slot'>>;

export interface TransitionOptions {
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
  /** Colonnes supplémentaires mises à jour dans la même transaction. */
  patch?: BookingPatch | ((b: BookingRow) => BookingPatch);
  /** Contrôle métier sur la ligne verrouillée, avant la vérification de la machine à états. */
  guard?: (b: BookingRow) => void | Promise<void>;
  /** Écritures complémentaires dans la transaction (après la mise à jour). */
  inTx?: (tx: Tx, b: BookingRow) => Promise<void>;
  /** Pas de notification (les appelants envoient la leur). */
  silent?: boolean;
}

const TIMESTAMP_COLUMNS: Partial<Record<BookingStatus, keyof BookingRow>> = {
  accepted: 'acceptedAt',
  arrived: 'arrivedAt',
  awaiting_code: 'workDoneAt',
  closed: 'closedAt',
  cancelled_by_client: 'cancelledAt',
  cancelled_by_artisan: 'cancelledAt',
  expired: 'cancelledAt',
};

const SYSTEM_MESSAGES: Partial<Record<BookingStatus, string>> = {
  accepted: 'Intervention confirmée.',
  en_route: "L'artisan est en route.",
  arrived: "L'artisan est arrivé.",
  quote_pending: 'Un devis a été envoyé.',
  in_progress: 'Devis accepté, travaux en cours.',
  awaiting_code: 'Travaux terminés : en attente du code de fin.',
  closed: 'Intervention terminée. Merci !',
  cancelled_by_client: 'Intervention annulée par le client.',
  cancelled_by_artisan: "Intervention annulée par l'artisan.",
  disputed: 'Un litige a été ouvert. Le support DEPANO revient vers vous sous 72 h.',
};

/**
 * Machine à états unique : verrou de ligne (SELECT … FOR UPDATE), contrôle de la transition,
 * horodatage, journal booking_events, puis — après commit — temps réel, notifications et message système.
 */
@Injectable()
export class BookingStateService {
  private readonly logger = new Logger('BookingState');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ChatService) private readonly chat: ChatService,
  ) {}

  async transition(bookingId: string, to: BookingStatus, actor: Actor, actorUserId: string | null, opts: TransitionOptions = {}): Promise<BookingRow> {
    const { before, after } = await this.conn.db.transaction(async (tx) => {
      const [b] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update');
      if (!b) throw notFound('booking_not_found', 'Intervention introuvable.');
      if (opts.guard) await opts.guard(b);
      if (!findTransition(b.status as BookingStatus, to, actor, b.kind)) {
        throw conflict('invalid_transition', "Cette action n'est pas possible dans l'état actuel de l'intervention.", {
          from: b.status,
          to,
          actor,
        });
      }
      const now = new Date();
      const patch = typeof opts.patch === 'function' ? opts.patch(b) : (opts.patch ?? {});
      const tsCol = TIMESTAMP_COLUMNS[to];
      const [updated] = await tx
        .update(bookings)
        .set({ ...patch, status: to, ...(tsCol ? { [tsCol]: now } : {}), updatedAt: now })
        .where(eq(bookings.id, bookingId))
        .returning();
      await tx.insert(bookingEvents).values({
        bookingId,
        fromStatus: b.status,
        toStatus: to,
        actor,
        actorUserId,
        note: opts.note ?? null,
        lat: opts.lat ?? null,
        lng: opts.lng ?? null,
      });
      if (opts.inTx) await opts.inTx(tx, updated!);
      return { before: b, after: updated! };
    });
    await this.afterCommit(before, after, actor, opts.silent ?? false).catch((e) => this.logger.error(`effets post-transition : ${e}`));
    return after;
  }

  /** Journalise la création (aucune transition de la machine). */
  async logCreation(tx: Tx, bookingId: string, actorUserId: string) {
    await tx.insert(bookingEvents).values({ bookingId, fromStatus: null, toStatus: 'pending_payment', actor: 'client', actorUserId });
  }

  private async artisanInfo(artisanId: string | null) {
    if (!artisanId) return null;
    const [a] = await this.conn.db
      .select({ userId: artisanProfiles.userId, name: artisanProfiles.displayName })
      .from(artisanProfiles)
      .where(eq(artisanProfiles.id, artisanId));
    return a ?? null;
  }

  private async afterCommit(before: BookingRow, b: BookingRow, actor: Actor, silent: boolean) {
    const artisan = await this.artisanInfo(b.artisanId);
    const to = b.status as BookingStatus;
    this.realtime.emitToBooking(
      b.id,
      'booking.updated',
      { bookingId: b.id, status: to, at: b.updatedAt.toISOString() },
      [b.clientId, ...(artisan ? [artisan.userId] : [])],
    );
    const sys = SYSTEM_MESSAGES[to];
    if (sys) await this.chat.systemMessage(b.id, sys);
    if (silent) return;
    for (const [userId, n] of this.messagesFor(before, b, actor, artisan)) await this.notifications.notify(userId, n);
  }

  private messagesFor(before: BookingRow, b: BookingRow, actor: Actor, artisan: { userId: string; name: string } | null): [string, NotifyInput][] {
    const link = DEEP_LINKS.intervention(b.id);
    const data = { bookingId: b.id, status: b.status };
    const out: [string, NotifyInput][] = [];
    const toClient = (n: Omit<NotifyInput, 'link' | 'data'>) => out.push([b.clientId, { ...n, link, data }]);
    const toArtisan = (n: Omit<NotifyInput, 'link' | 'data'>) => artisan && out.push([artisan.userId, { ...n, link, data }]);
    const when = b.scheduledAt ? formatParis(b.scheduledAt) : '';
    switch (b.status as BookingStatus) {
      case 'accepted':
        if (b.kind === 'urgent') {
          toClient({ type: 'booking_accepted', title: 'Artisan trouvé !', body: `${artisan?.name ?? 'Un artisan'} a accepté votre demande et se prépare.` });
        } else {
          toClient({ type: 'booking_accepted', title: 'Rendez-vous confirmé', body: `${artisan?.name ?? "L'artisan"} interviendra le ${when}.` });
          toArtisan({ type: 'booking_created', title: 'Nouveau rendez-vous', body: `${b.problemReason} — ${when}.` });
        }
        break;
      case 'en_route':
        toClient({ type: 'booking_status', title: 'Votre artisan est en route', body: `${artisan?.name ?? "L'artisan"} est en chemin. Suivez son arrivée en direct.` });
        break;
      case 'arrived':
        if (before.status === 'quote_pending') {
          toArtisan({ type: 'quote_answered', title: actor === 'system' ? 'Devis expiré' : 'Devis refusé', body: 'Vous pouvez proposer un nouveau devis ou clôturer en déplacement seul.' });
        } else {
          toClient({ type: 'booking_status', title: 'Votre artisan est arrivé', body: `${artisan?.name ?? "L'artisan"} est devant chez vous.` });
        }
        break;
      case 'quote_pending':
        toClient({ type: 'quote_received', title: 'Devis à valider', body: 'Consultez et validez le devis avant le début des travaux.' });
        break;
      case 'in_progress':
        toArtisan({ type: 'quote_answered', title: 'Devis accepté', body: 'Le client a validé votre devis : vous pouvez commencer.' });
        break;
      case 'awaiting_code':
        toClient({ type: 'booking_status', title: 'Travaux terminés', body: "Vérifiez l'intervention puis communiquez votre code de fin à l'artisan." });
        break;
      case 'closed':
        toClient({ type: 'booking_status', title: 'Intervention terminée', body: "Merci ! Votre facture sera disponible dans l'app. Pensez à laisser un avis." });
        toArtisan({ type: 'payout', title: 'Intervention clôturée', body: 'Le paiement a été capturé et sera versé sur votre compte.' });
        break;
      case 'cancelled_by_client':
        toArtisan({ type: 'booking_cancelled', title: 'Intervention annulée', body: `Le client a annulé « ${b.problemReason} ».` });
        break;
      case 'cancelled_by_artisan':
        toClient({ type: 'booking_cancelled', title: "L'artisan a annulé", body: 'Nous sommes désolés. Nous vous proposons une reprogrammation prioritaire.' });
        break;
      case 'disputed':
        toArtisan({ type: 'booking_status', title: 'Litige ouvert', body: 'Le client a signalé un problème. Le paiement est suspendu le temps de l’arbitrage.' });
        break;
      default:
        break;
    }
    return out;
  }
}
