import { Inject, Injectable } from '@nestjs/common';
import { RULES, type Paginated, type ReviewBody, type ReviewDto } from '@depano/schemas';
import { and, artisanProfiles, desc, eq, inArray, isNull, lt, or, reviews, sql, users } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { conflict, forbidden, notFound } from '../../common/errors';
import { decodeTimeCursor, encodeTimeCursor } from '../../common/pagination';
import type { BookingRow } from '../bookings/booking-state.service';

type ReviewRow = typeof reviews.$inferSelect;

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async toDtos(rows: ReviewRow[]): Promise<ReviewDto[]> {
    if (!rows.length) return [];
    const authors = await this.conn.db
      .select({ id: users.id, first: users.firstName })
      .from(users)
      .where(inArray(users.id, [...new Set(rows.map((r) => r.authorId))]));
    const names = new Map(authors.map((a) => [a.id, a.first]));
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        bookingId: r.bookingId,
        rating: r.rating,
        tags: r.tags,
        comment: r.comment,
        photoUrls: await this.filesService.signedUrls(r.photoFileIds),
        authorFirstName: names.get(r.authorId) ?? 'Client',
        createdAt: r.createdAt.toISOString(),
        reply: r.replyBody && r.replyAt ? { body: r.replyBody, createdAt: r.replyAt.toISOString() } : null,
      })),
    );
  }

  async forBooking(bookingId: string) {
    const [r] = await this.conn.db.select().from(reviews).where(eq(reviews.bookingId, bookingId));
    return r ?? null;
  }

  async listForArtisan(artisanId: string, cursor?: string, limit = 20): Promise<Paginated<ReviewDto>> {
    const c = decodeTimeCursor(cursor);
    const rows = await this.conn.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.artisanId, artisanId),
          isNull(reviews.hiddenAt),
          c ? or(lt(reviews.createdAt, c.at), and(eq(reviews.createdAt, c.at), lt(reviews.id, c.id))) : undefined,
        ),
      )
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items: await this.toDtos(items), nextCursor: rows.length > limit && last ? encodeTimeCursor(last.createdAt, last.id) : null };
  }

  async recent(artisanId: string, n = 5) {
    return (await this.listForArtisan(artisanId, undefined, n)).items;
  }

  /** Avis client : intervention clôturée depuis moins de 14 jours, un seul par intervention. */
  async create(b: BookingRow, userId: string, body: ReviewBody): Promise<ReviewDto> {
    if (b.clientId !== userId) throw forbidden('review_forbidden', 'Seul le client peut noter cette intervention.');
    if (b.status !== 'closed' || !b.closedAt || !b.artisanId) throw conflict('review_not_allowed', "L'intervention doit être terminée pour être notée.");
    if (Date.now() - b.closedAt.getTime() > RULES.reviewWindowDays * 86_400_000) {
      throw conflict('review_window_closed', `Les avis sont ouverts ${RULES.reviewWindowDays} jours après l'intervention.`);
    }
    await this.filesService.assertOwned(userId, body.photoFileIds, ['review', 'problem_photo']);
    const inserted = await this.conn.db
      .insert(reviews)
      .values({ bookingId: b.id, artisanId: b.artisanId, authorId: userId, rating: body.rating, tags: body.tags, comment: body.comment ?? null, photoFileIds: body.photoFileIds })
      .onConflictDoNothing({ target: reviews.bookingId })
      .returning();
    if (!inserted.length) throw conflict('review_exists', 'Vous avez déjà noté cette intervention.');
    await this.refreshAggregates(b.artisanId);
    const [a] = await this.conn.db.select({ userId: artisanProfiles.userId }).from(artisanProfiles).where(eq(artisanProfiles.id, b.artisanId));
    if (a) {
      await this.notifications.notify(a.userId, {
        type: 'review_received',
        title: `Nouvel avis ${'★'.repeat(body.rating)}`,
        body: body.comment ? body.comment.slice(0, 140) : 'Un client a noté votre intervention.',
        link: `depano://avis/${inserted[0]!.id}`,
        data: { reviewId: inserted[0]!.id, bookingId: b.id },
      });
    }
    return (await this.toDtos(inserted))[0]!;
  }

  async refreshAggregates(artisanId: string) {
    await this.conn.db.execute(sql`
      update artisan_profiles a set
        rating_avg = s.avg, rating_count = s.n
      from (select avg(rating)::real as avg, count(*)::int as n from reviews where artisan_id = ${artisanId} and hidden_at is null) s
      where a.id = ${artisanId}`);
  }

  async reply(artisanUserId: string, reviewId: string, body: string): Promise<ReviewDto> {
    const [r] = await this.conn.db
      .select({ review: reviews, ownerUserId: artisanProfiles.userId })
      .from(reviews)
      .innerJoin(artisanProfiles, eq(artisanProfiles.id, reviews.artisanId))
      .where(eq(reviews.id, reviewId));
    if (!r) throw notFound('review_not_found', 'Avis introuvable.');
    if (r.ownerUserId !== artisanUserId) throw forbidden('review_forbidden', 'Seul l’artisan concerné peut répondre à cet avis.');
    const [updated] = await this.conn.db.update(reviews).set({ replyBody: body, replyAt: new Date() }).where(eq(reviews.id, reviewId)).returning();
    return (await this.toDtos([updated!]))[0]!;
  }
}
