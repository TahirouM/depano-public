import { Inject, Injectable, Logger } from '@nestjs/common';
import { DEFAULT_NOTIFICATION_PREFS, notificationPrefCategory, type NotificationDto, type NotificationType, type Paginated } from '@depano/schemas';
import { and, desc, eq, isNull, lt, notifications, or, pushTokens, sql, users } from '@depano/db';
import { arrayContains } from 'drizzle-orm';
import { DbConnection } from '../../infra/db';
import { JobsService } from '../../infra/jobs';
import { RealtimeService } from '../../infra/realtime';
import { PUSH_PROVIDER, SMS_PROVIDER } from '../../infra/tokens';
import type { PushProvider, SmsProvider } from '../../providers/messaging.providers';
import { notFound } from '../../common/errors';
import { decodeTimeCursor, encodeTimeCursor } from '../../common/pagination';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  data?: Record<string, unknown>;
  /** false : notification in-app seulement. */
  push?: boolean;
}

export const toNotificationDto = (n: typeof notifications.$inferSelect): NotificationDto => ({
  id: n.id,
  type: n.type as NotificationType,
  title: n.title,
  body: n.body,
  link: n.link,
  data: (n.data ?? {}) as Record<string, unknown>,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});

/** Notifications in-app (ligne + temps réel) et push (file « notifications »). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async notify(userId: string, input: NotifyInput): Promise<NotificationDto> {
    const [n] = await this.conn.db
      .insert(notifications)
      .values({ userId, type: input.type, title: input.title, body: input.body, link: input.link ?? null, data: input.data ?? {} })
      .returning();
    const dto = toNotificationDto(n!);
    this.realtime.emitToUser(userId, 'notification.created', dto);
    if (input.push !== false) {
      await this.jobs.add('notifications', 'push', {
        userId,
        title: input.title,
        body: input.body,
        link: input.link ?? undefined,
        data: { ...(input.data ?? {}), notificationId: dto.id, type: input.type },
      });
    }
    return dto;
  }

  async notifyMany(userIds: string[], input: NotifyInput) {
    for (const id of [...new Set(userIds)]) await this.notify(id, input);
  }

  /** Alerte tous les membres du support (et admins). */
  async notifySupport(input: NotifyInput) {
    const staff = await this.conn.db
      .select({ id: users.id })
      .from(users)
      .where(and(isNull(users.deletedAt), or(arrayContains(users.roles, ['support']), arrayContains(users.roles, ['admin']))));
    await this.notifyMany(
      staff.map((s) => s.id),
      input,
    );
  }

  async pushOnly(userId: string, title: string, body: string, link?: string, data?: Record<string, unknown>) {
    await this.jobs.add('notifications', 'push', { userId, title, body, link, data });
  }

  /** Traitement du job « push » (worker). */
  async deliverPush(job: { userId: string; title: string; body: string; link?: string; data?: Record<string, unknown> }) {
    // Préférences : la notification in-app est déjà enregistrée ; seul le push est filtré.
    const category = notificationPrefCategory(typeof job.data?.type === 'string' ? job.data.type : undefined);
    if (category) {
      const [u] = await this.conn.db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, job.userId));
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(u?.prefs ?? {}) };
      if (!prefs[category]) return { sent: 0, skipped: 'preference' as const };
    }
    const tokens = await this.conn.db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, job.userId), isNull(pushTokens.disabledAt)));
    if (!tokens.length) return { sent: 0 };
    const { invalidTokens } = await this.push.send(
      tokens.map((t) => ({ token: t.token, title: job.title, body: job.body, data: { ...(job.data ?? {}), link: job.link } })),
    );
    for (const t of invalidTokens) await this.conn.db.update(pushTokens).set({ disabledAt: new Date() }).where(eq(pushTokens.token, t));
    return { sent: tokens.length - invalidTokens.length };
  }

  async deliverSms(job: { phone: string; body: string }) {
    await this.sms.send(job.phone, job.body);
    return { sent: 1 };
  }

  async list(userId: string, cursor?: string, limit = 30): Promise<Paginated<NotificationDto>> {
    const c = decodeTimeCursor(cursor);
    const rows = await this.conn.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          c ? or(lt(notifications.createdAt, c.at), and(eq(notifications.createdAt, c.at), lt(notifications.id, c.id))) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return { items: items.map(toNotificationDto), nextCursor: rows.length > limit && last ? encodeTimeCursor(last.createdAt, last.id) : null };
  }

  async markRead(userId: string, id: string) {
    const r = await this.conn.db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    if (!r.length) throw notFound('notification_not_found', 'Notification introuvable.');
  }

  async markAllRead(userId: string) {
    await this.conn.db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  async unreadCount(userId: string) {
    const [r] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return r?.n ?? 0;
  }
}
