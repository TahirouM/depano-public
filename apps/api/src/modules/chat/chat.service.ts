import { Inject, Injectable } from '@nestjs/common';
import {
  DEEP_LINKS,
  REALTIME_ROOMS,
  TERMINAL_BOOKING_STATUSES,
  type BookingStatus,
  type ConversationDto,
  type DomainCode,
  type MessageDto,
  type Paginated,
  type SendMessageBody,
} from '@depano/schemas';
import { and, artisanProfiles, bookings, conversations, desc, eq, inArray, lt, messages, or, sql, users } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { RealtimeService } from '../../infra/realtime';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { forbidden, notFound } from '../../common/errors';
import type { DbOrTx } from '@depano/db';

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

export const CHAT_OPEN_DAYS_AFTER_END = 7;

@Injectable()
export class ChatService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  /** Crée (idempotent) la conversation d'une intervention dès qu'un artisan est assigné. */
  async ensureConversation(db: DbOrTx, bookingId: string, clientUserId: string, artisanUserId: string) {
    await db.insert(conversations).values({ bookingId, clientUserId, artisanUserId }).onConflictDoNothing({ target: conversations.bookingId });
    const [c] = await db.select().from(conversations).where(eq(conversations.bookingId, bookingId));
    return c!;
  }

  private async getForUser(userId: string, conversationId: string) {
    const [c] = await this.conn.db.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!c) throw notFound('conversation_not_found', 'Conversation introuvable.');
    if (c.clientUserId !== userId && c.artisanUserId !== userId) throw forbidden('conversation_forbidden', "Vous n'avez pas accès à cette conversation.");
    return c;
  }

  async isParticipant(userId: string, conversationId: string) {
    const [c] = await this.conn.db.select({ c: conversations.clientUserId, a: conversations.artisanUserId }).from(conversations).where(eq(conversations.id, conversationId));
    return !!c && (c.c === userId || c.a === userId);
  }

  private async toMessageDtos(rows: MessageRow[], c: ConversationRow, viewerId: string): Promise<MessageDto[]> {
    const urls = new Map<string, string | null>();
    for (const r of rows) if (r.fileId && !urls.has(r.fileId)) urls.set(r.fileId, await this.filesService.signedUrl(r.fileId));
    return rows.map((m) => {
      const otherRead = viewerId === c.clientUserId ? c.artisanLastReadAt : c.clientLastReadAt;
      const mineRead = viewerId === c.clientUserId ? c.clientLastReadAt : c.artisanLastReadAt;
      const ref = m.senderId === viewerId ? otherRead : mineRead;
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        kind: m.kind,
        body: m.body,
        fileUrl: m.fileId ? (urls.get(m.fileId) ?? null) : null,
        durationMs: m.kind === 'voice' ? (m.durationMs ?? null) : null,
        clientId: m.clientId,
        createdAt: m.createdAt.toISOString(),
        readAt: ref && ref >= m.createdAt ? ref.toISOString() : null,
      };
    });
  }

  async unreadCount(c: ConversationRow, viewerId: string) {
    const lastRead = viewerId === c.clientUserId ? c.clientLastReadAt : c.artisanLastReadAt;
    const [r] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, c.id),
          sql`${messages.senderId} is not null and ${messages.senderId} <> ${viewerId}`,
          lastRead ? sql`${messages.createdAt} > ${lastRead.toISOString()}::timestamptz` : undefined,
        ),
      );
    return r?.n ?? 0;
  }

  async totalUnread(userId: string) {
    const [r] = await this.conn.db.execute<{ n: number }>(sql`
      select count(*)::int as n from messages m join conversations c on c.id = m.conversation_id
      where (c.client_user_id = ${userId} or c.artisan_user_id = ${userId})
        and m.sender_id is not null and m.sender_id <> ${userId}
        and m.created_at > coalesce(case when c.client_user_id = ${userId} then c.client_last_read_at else c.artisan_last_read_at end, 'epoch'::timestamptz)`);
    return Number(r?.n ?? 0);
  }

  async listConversations(userId: string): Promise<ConversationDto[]> {
    const rows = await this.conn.db
      .select({ c: conversations, b: { reference: bookings.reference, status: bookings.status, domain: bookings.domain } })
      .from(conversations)
      .innerJoin(bookings, eq(bookings.id, conversations.bookingId))
      .where(or(eq(conversations.clientUserId, userId), eq(conversations.artisanUserId, userId)))
      .orderBy(desc(sql`coalesce(${conversations.lastMessageAt}, ${conversations.createdAt})`))
      .limit(200);
    const out: ConversationDto[] = [];
    for (const { c, b } of rows) {
      const [last] = await this.conn.db.select().from(messages).where(eq(messages.conversationId, c.id)).orderBy(desc(messages.createdAt)).limit(1);
      out.push({
        id: c.id,
        bookingId: c.bookingId,
        bookingReference: b.reference,
        bookingStatus: b.status as BookingStatus,
        domain: b.domain as DomainCode,
        counterpart: await this.counterpart(c, userId),
        lastMessage: last ? ((await this.toMessageDtos([last], c, userId))[0] ?? null) : null,
        unreadCount: await this.unreadCount(c, userId),
        updatedAt: (c.lastMessageAt ?? c.createdAt).toISOString(),
      });
    }
    return out;
  }

  private async counterpart(c: ConversationRow, viewerId: string) {
    if (viewerId === c.clientUserId) {
      const [a] = await this.conn.db
        .select({ id: artisanProfiles.id, name: artisanProfiles.displayName, avatar: users.avatarFileId })
        .from(artisanProfiles)
        .innerJoin(users, eq(users.id, artisanProfiles.userId))
        .where(eq(artisanProfiles.userId, c.artisanUserId));
      return { id: a?.id ?? c.artisanUserId, name: a?.name ?? 'Artisan', avatarUrl: await this.filesService.signedUrl(a?.avatar) };
    }
    const [u] = await this.conn.db.select({ first: users.firstName, avatar: users.avatarFileId }).from(users).where(eq(users.id, c.clientUserId));
    return { id: c.clientUserId, name: u?.first ?? 'Client', avatarUrl: await this.filesService.signedUrl(u?.avatar) };
  }

  async listMessages(userId: string, conversationId: string, before?: string, limit = 30): Promise<Paginated<MessageDto>> {
    const c = await this.getForUser(userId, conversationId);
    let beforeAt: Date | null = null;
    if (before) {
      const [m] = await this.conn.db.select({ at: messages.createdAt }).from(messages).where(and(eq(messages.id, before), eq(messages.conversationId, c.id)));
      beforeAt = m?.at ?? (Number.isNaN(Date.parse(before)) ? null : new Date(before));
    }
    const rows = await this.conn.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, c.id), beforeAt ? lt(messages.createdAt, beforeAt) : undefined))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    return { items: await this.toMessageDtos(items, c, userId), nextCursor: rows.length > limit ? (items[items.length - 1]?.id ?? null) : null };
  }

  /** Messagerie ouverte tant que l'intervention n'est pas terminée, puis 7 jours. */
  private async assertOpen(bookingId: string) {
    const [b] = await this.conn.db
      .select({ status: bookings.status, closedAt: bookings.closedAt, cancelledAt: bookings.cancelledAt, updatedAt: bookings.updatedAt })
      .from(bookings)
      .where(eq(bookings.id, bookingId));
    if (!b) throw notFound('booking_not_found', 'Intervention introuvable.');
    if (!TERMINAL_BOOKING_STATUSES.includes(b.status as BookingStatus)) return;
    const end = b.closedAt ?? b.cancelledAt ?? b.updatedAt;
    if (Date.now() - end.getTime() > CHAT_OPEN_DAYS_AFTER_END * 86_400_000) {
      throw forbidden('conversation_closed', 'Cette conversation est fermée.');
    }
  }

  async send(userId: string, conversationId: string, body: SendMessageBody): Promise<MessageDto> {
    const c = await this.getForUser(userId, conversationId);
    await this.assertOpen(c.bookingId);
    if (body.fileId) await this.filesService.assertOwned(userId, [body.fileId], ['chat', 'problem_photo', 'problem_voice']);
    const inserted = await this.conn.db
      .insert(messages)
      .values({ conversationId: c.id, senderId: userId, kind: body.kind, body: body.body?.trim() || null, fileId: body.fileId ?? null, durationMs: body.kind === 'voice' ? (body.durationMs ?? null) : null, clientId: body.clientId })
      .onConflictDoNothing({ target: [messages.conversationId, messages.clientId] })
      .returning();
    const isNew = inserted.length > 0;
    const [row] = isNew ? inserted : await this.conn.db.select().from(messages).where(and(eq(messages.conversationId, c.id), eq(messages.clientId, body.clientId)));
    const now = row!.createdAt;
    if (isNew) {
      const readCol = userId === c.clientUserId ? { clientLastReadAt: now } : { artisanLastReadAt: now };
      await this.conn.db.update(conversations).set({ lastMessageAt: now, ...readCol }).where(eq(conversations.id, c.id));
    }
    const fresh = { ...c, ...(userId === c.clientUserId ? { clientLastReadAt: now } : { artisanLastReadAt: now }) };
    const [dto] = await this.toMessageDtos([row!], fresh, userId);
    if (isNew) {
      const other = userId === c.clientUserId ? c.artisanUserId : c.clientUserId;
      this.realtime.emitToRooms([REALTIME_ROOMS.conversation(c.id), REALTIME_ROOMS.user(c.clientUserId), REALTIME_ROOMS.user(c.artisanUserId)], 'message.created', dto!);
      const [sender] = await this.conn.db.select({ first: users.firstName }).from(users).where(eq(users.id, userId));
      const preview = body.kind === 'text' ? (body.body ?? '').slice(0, 120) : body.kind === 'image' ? '📷 Photo' : '🎤 Message vocal';
      await this.notifications.pushOnly(other, sender?.first ?? 'Nouveau message', preview, DEEP_LINKS.conversation(c.id), { conversationId: c.id, type: 'message' });
    }
    return dto!;
  }

  async markRead(userId: string, conversationId: string) {
    const c = await this.getForUser(userId, conversationId);
    const now = new Date();
    await this.conn.db
      .update(conversations)
      .set(userId === c.clientUserId ? { clientLastReadAt: now } : { artisanLastReadAt: now })
      .where(eq(conversations.id, c.id));
    this.realtime.emitToRooms([REALTIME_ROOMS.conversation(c.id), REALTIME_ROOMS.user(c.clientUserId), REALTIME_ROOMS.user(c.artisanUserId)], 'message.read', {
      conversationId: c.id,
      userId,
      at: now.toISOString(),
    });
  }

  /** Message système dans la conversation d'une intervention (changement d'état…). */
  async systemMessage(bookingId: string, body: string) {
    const [c] = await this.conn.db.select().from(conversations).where(eq(conversations.bookingId, bookingId));
    if (!c) return;
    const [row] = await this.conn.db.insert(messages).values({ conversationId: c.id, senderId: null, kind: 'system', body }).returning();
    await this.conn.db.update(conversations).set({ lastMessageAt: row!.createdAt }).where(eq(conversations.id, c.id));
    const [dto] = await this.toMessageDtos([row!], c, c.clientUserId);
    this.realtime.emitToRooms([REALTIME_ROOMS.conversation(c.id), REALTIME_ROOMS.user(c.clientUserId), REALTIME_ROOMS.user(c.artisanUserId)], 'message.created', dto!);
  }

  async conversationForBooking(bookingId: string) {
    const [c] = await this.conn.db.select().from(conversations).where(eq(conversations.bookingId, bookingId));
    return c ?? null;
  }

  async messagesForBooking(bookingId: string): Promise<MessageDto[]> {
    const c = await this.conversationForBooking(bookingId);
    if (!c) return [];
    const rows = await this.conn.db.select().from(messages).where(eq(messages.conversationId, c.id)).orderBy(messages.createdAt);
    return this.toMessageDtos(rows, c, c.clientUserId);
  }

  /** Purge RGPD : messages (et pièces jointes) de plus de N années. */
  async purgeOlderThan(date: Date) {
    const old = await this.conn.db.select({ id: messages.id, fileId: messages.fileId }).from(messages).where(lt(messages.createdAt, date));
    if (!old.length) return { messages: 0, fileIds: [] as string[] };
    await this.conn.db.delete(messages).where(
      inArray(
        messages.id,
        old.map((m) => m.id),
      ),
    );
    return { messages: old.length, fileIds: old.map((m) => m.fileId).filter((x): x is string => !!x) };
  }
}
