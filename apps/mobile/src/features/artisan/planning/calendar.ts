import type {
  AvailabilityExceptionDto,
  BookingSummaryDto,
  DomainCode,
  EventColor,
} from '@depano/schemas';
import { addDays, bookingWhen, localDayKey, startOfDay, startOfMonth, startOfWeek } from '../dates';

/** Helpers purs du planning (calendrier du mois, frise du jour) : testés avec Vitest. */

/** Durée affichée d'une intervention sans heure de fin (urgence). */
export const DEFAULT_BOOKING_MINUTES = 60;

const CANCELLED = ['cancelled_by_client', 'cancelled_by_artisan', 'expired'];

/** Semaines du mois affiché (lundi en premier) : `null` pour les jours hors du mois (cases vides). */
export function monthWeeks(month: Date): (Date | null)[][] {
  const first = startOfMonth(month);
  const start = startOfWeek(first);
  const weeks: (Date | null)[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
    if (w > 0 && week[0]!.getMonth() !== first.getMonth()) break;
    weeks.push(week.map((d) => (d.getMonth() === first.getMonth() ? d : null)));
  }
  return weeks;
}

export type PlanningItem =
  | { type: 'booking'; id: string; start: Date; end: Date; booking: BookingSummaryDto }
  | {
      type: 'personal' | 'unavailable';
      id: string;
      start: Date;
      end: Date;
      /** Couvre toute la journée affichée (congés, période) : affiché en bandeau. */
      allDay: boolean;
      exception: AvailabilityExceptionDto;
    };

/** Éléments d'une journée (interventions non annulées + événements), triés par heure de début. */
export function dayItems(
  planning: { bookings: BookingSummaryDto[]; exceptions: AvailabilityExceptionDto[] },
  day: Date,
): PlanningItem[] {
  const s = startOfDay(day);
  const e = addDays(s, 1);
  const k = localDayKey(day);
  const items: PlanningItem[] = [];
  for (const b of planning.bookings) {
    if (CANCELLED.includes(b.status) || localDayKey(bookingWhen(b)) !== k) continue;
    const start = new Date(bookingWhen(b));
    items.push({
      type: 'booking',
      id: b.id,
      start,
      end: b.endsAt ? new Date(b.endsAt) : new Date(start.getTime() + DEFAULT_BOOKING_MINUTES * 60_000),
      booking: b,
    });
  }
  for (const x of planning.exceptions) {
    const start = new Date(x.startsAt);
    const end = new Date(x.endsAt);
    if (start >= e || end <= s) continue;
    items.push({
      type: x.kind === 'personal' ? 'personal' : 'unavailable',
      id: x.id,
      start,
      end,
      allDay: start <= s && end >= e,
      exception: x,
    });
  }
  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Pastille sous un jour du calendrier. */
export type DayDot =
  | { key: string; type: 'domain'; domain: DomainCode; urgent: boolean; requested: boolean }
  | { key: string; type: 'event'; color: EventColor }
  | { key: string; type: 'unavailable' };

/** Jusqu'à `max` pastilles par jour, dans l'ordre de la journée. */
export function dayDots(items: PlanningItem[], max = 3): DayDot[] {
  return items.slice(0, max).map((i): DayDot => {
    if (i.type === 'booking')
      return {
        key: i.id,
        type: 'domain',
        domain: i.booking.domain,
        urgent: i.booking.kind === 'urgent',
        requested: i.booking.status === 'requested',
      };
    if (i.type === 'personal')
      return { key: i.id, type: 'event', color: i.exception.color ?? 'blue' };
    return { key: i.id, type: 'unavailable' };
  });
}

export interface TimelineRow {
  /** Heure de la ligne (8 → « 8:00 »). */
  hour: number;
  items: PlanningItem[];
}

/**
 * Frise du jour (maquette « Mon planning ») : une ligne toutes les `step` heures entre `minHour` et `maxHour`,
 * élargie pour inclure les éléments tôt le matin ou tard le soir ; chaque élément est rangé sous la ligne de
 * son heure de début. Les éléments « toute la journée » sont exclus (affichés en bandeau).
 */
export function timelineRows(
  items: PlanningItem[],
  opts: { minHour?: number; maxHour?: number; step?: number; day?: Date } = {},
): TimelineRow[] {
  const step = opts.step ?? 2;
  const timed = items.filter((i) => i.type === 'booking' || !i.allDay);
  const dayStart = opts.day ? startOfDay(opts.day).getTime() : null;
  // Heure de début dans la journée affichée (un événement commencé la veille démarre à 0 h).
  const hourOf = (i: PlanningItem) =>
    dayStart != null && i.start.getTime() < dayStart ? 0 : i.start.getHours();
  let min = opts.minHour ?? 8;
  let max = opts.maxHour ?? 20;
  for (const i of timed) {
    min = Math.min(min, hourOf(i));
    max = Math.max(max, hourOf(i));
  }
  const first = min - ((((min - (opts.minHour ?? 8)) % step) + step) % step);
  const rows: TimelineRow[] = [];
  for (let h = first; h <= max; h += step) rows.push({ hour: h, items: [] });
  for (const i of timed) {
    const idx = Math.floor((hourOf(i) - first) / step);
    rows[Math.min(Math.max(idx, 0), rows.length - 1)]!.items.push(i);
  }
  return rows;
}

/** « 8:00 », « 14:30 » (format de la maquette). */
export function shortTime(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
