import { Inject, Injectable } from '@nestjs/common';
import type { SlotDay } from '@depano/schemas';
import { and, artisanServices, availabilityExceptions, availabilityRules, bookings, eq, gt, inArray, lt, services } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { addDays, minutes, parisDate, parisToUtc, weekdayOf } from '../../common/time';

export const SLOT_STEP_MINUTES = 30;
/** Délai minimal avant un créneau réservable. */
export const SLOT_MIN_NOTICE_MINUTES = 60;
/** Statuts qui occupent l'agenda (identiques à la contrainte bookings_no_overlap). */
export const BLOCKING_STATUSES = ['pending_payment', 'accepted', 'en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code'] as const;

interface Busy {
  start: number;
  end: number;
}

export interface SlotContext {
  rules: { weekday: number; startTime: string; endTime: string }[];
  busy: Busy[];
}

/** Calcul pur des créneaux (heures locales Europe/Paris, pas de 30 min). Exporté pour les tests unitaires. */
export function computeSlotDays(ctx: SlotContext, fromDate: string, nDays: number, durationMinutes: number, now = new Date()): SlotDay[] {
  const out: SlotDay[] = [];
  const earliest = now.getTime() + minutes(SLOT_MIN_NOTICE_MINUTES);
  for (let i = 0; i < nDays; i++) {
    const date = addDays(fromDate, i);
    const wd = weekdayOf(date);
    const slots: string[] = [];
    for (const r of ctx.rules.filter((x) => x.weekday === wd).sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const winStart = parisToUtc(date, r.startTime).getTime();
      const winEnd = parisToUtc(date, r.endTime).getTime();
      for (let t = winStart; t + minutes(durationMinutes) <= winEnd; t += minutes(SLOT_STEP_MINUTES)) {
        const end = t + minutes(durationMinutes);
        if (t < earliest) continue;
        if (ctx.busy.some((b) => t < b.end && end > b.start)) continue;
        slots.push(new Date(t).toISOString());
      }
    }
    out.push({ date, slots: [...new Set(slots)].sort() });
  }
  return out;
}

@Injectable()
export class SlotsService {
  constructor(@Inject(DbConnection) private readonly conn: DbConnection) {}

  async durationFor(artisanId: string, serviceId?: string | null): Promise<number> {
    if (serviceId) {
      const [as] = await this.conn.db
        .select({ d: artisanServices.durationMinutes })
        .from(artisanServices)
        .where(and(eq(artisanServices.artisanId, artisanId), eq(artisanServices.serviceId, serviceId)));
      if (as) return as.d;
      const [s] = await this.conn.db.select({ d: services.defaultDurationMinutes }).from(services).where(eq(services.id, serviceId));
      if (s) return s.d;
    }
    return 60;
  }

  private async contexts(artisanIds: string[], start: Date, end: Date, excludeBookingId?: string) {
    const map = new Map<string, SlotContext>(artisanIds.map((id) => [id, { rules: [], busy: [] }]));
    if (!artisanIds.length) return map;
    const db = this.conn.db;
    const [rules, exceptions, booked] = await Promise.all([
      db.select().from(availabilityRules).where(inArray(availabilityRules.artisanId, artisanIds)),
      db
        .select()
        .from(availabilityExceptions)
        .where(and(inArray(availabilityExceptions.artisanId, artisanIds), lt(availabilityExceptions.startsAt, end), gt(availabilityExceptions.endsAt, start))),
      db
        .select({ id: bookings.id, artisanId: bookings.artisanId, s: bookings.scheduledAt, e: bookings.endsAt })
        .from(bookings)
        .where(
          and(
            inArray(bookings.artisanId, artisanIds),
            inArray(bookings.status, [...BLOCKING_STATUSES]),
            lt(bookings.scheduledAt, end),
            gt(bookings.endsAt, start),
          ),
        ),
    ]);
    for (const r of rules) map.get(r.artisanId)!.rules.push(r);
    for (const x of exceptions) map.get(x.artisanId)!.busy.push({ start: x.startsAt.getTime(), end: x.endsAt.getTime() });
    for (const b of booked) {
      if (b.id === excludeBookingId || !b.artisanId || !b.s || !b.e) continue;
      map.get(b.artisanId)!.busy.push({ start: b.s.getTime(), end: b.e.getTime() });
    }
    return map;
  }

  async slots(artisanId: string, opts: { serviceId?: string; from?: string; days: number }, now = new Date()): Promise<SlotDay[]> {
    const today = parisDate(now);
    const from = opts.from && opts.from > today ? opts.from : today;
    const start = parisToUtc(from, '00:00');
    const end = parisToUtc(addDays(from, opts.days), '00:00');
    const duration = await this.durationFor(artisanId, opts.serviceId);
    const ctx = (await this.contexts([artisanId], start, end)).get(artisanId)!;
    return computeSlotDays(ctx, from, opts.days, duration, now);
  }

  async isAvailable(artisanId: string, serviceId: string | null | undefined, at: Date, now = new Date()) {
    const days = await this.slots(artisanId, { serviceId: serviceId ?? undefined, from: parisDate(at), days: 1 }, now);
    return days.some((d) => d.slots.includes(at.toISOString()));
  }

  /** Prochain créneau libre de chaque artisan (14 jours). */
  async nextSlots(artisanIds: string[], now = new Date(), horizonDays = 14): Promise<Map<string, string | null>> {
    const today = parisDate(now);
    const start = parisToUtc(today, '00:00');
    const end = parisToUtc(addDays(today, horizonDays), '00:00');
    const ctxs = await this.contexts(artisanIds, start, end);
    const out = new Map<string, string | null>();
    for (const id of artisanIds) {
      const days = computeSlotDays(ctxs.get(id)!, today, horizonDays, 60, now);
      out.set(id, days.find((d) => d.slots.length)?.slots[0] ?? null);
    }
    return out;
  }
}
