import { Inject, Injectable } from '@nestjs/common';
import { RULES } from '@depano/schemas';
import { and, artisanProfiles, bookings, eq, gte, sql } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { NotificationsService } from '../notifications/notifications.service';
import { days } from '../../common/time';

/** Fiabilité artisan : 3 annulations en 30 jours ⇒ urgences suspendues 30 jours. */
@Injectable()
export class ReliabilityService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async cancellations30d(artisanId: string) {
    const [r] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.artisanId, artisanId), eq(bookings.status, 'cancelled_by_artisan'), gte(bookings.cancelledAt, new Date(Date.now() - days(30)))));
    return r?.n ?? 0;
  }

  async onArtisanCancellation(artisanId: string) {
    await this.conn.db
      .update(artisanProfiles)
      .set({ reliabilityScore: sql`greatest(0, ${artisanProfiles.reliabilityScore} - 10)` })
      .where(eq(artisanProfiles.id, artisanId));
    return this.check(artisanId);
  }

  async check(artisanId: string) {
    const n = await this.cancellations30d(artisanId);
    if (n < RULES.artisanReliability.maxCancellationsIn30Days) return { suspended: false, cancellations: n };
    const [a] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.id, artisanId));
    if (!a || (a.urgentSuspendedUntil && a.urgentSuspendedUntil > new Date())) return { suspended: true, cancellations: n, already: true };
    const until = new Date(Date.now() + days(30));
    await this.conn.db.update(artisanProfiles).set({ urgentSuspendedUntil: until, urgentAvailable: false }).where(eq(artisanProfiles.id, artisanId));
    await this.notifications.notify(a.userId, {
      type: 'booking_status',
      title: 'Urgences suspendues 30 jours',
      body: `${n} annulations en 30 jours : vous ne recevrez plus de demandes urgentes jusqu'au ${until.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.`,
      data: { artisanId, until: until.toISOString() },
    });
    return { suspended: true, cancellations: n };
  }

  /** Job maintenance « reliability » : contrôle de tous les artisans ayant annulé récemment. */
  async sweep() {
    const rows = await this.conn.db.execute<{ artisan_id: string }>(sql`
      select artisan_id from bookings
      where status = 'cancelled_by_artisan' and cancelled_at >= now() - interval '30 days' and artisan_id is not null
      group by artisan_id having count(*) >= ${RULES.artisanReliability.maxCancellationsIn30Days}`);
    let suspended = 0;
    for (const r of rows) if ((await this.check(r.artisan_id)).suspended) suspended++;
    return { checked: rows.length, suspended };
  }
}
