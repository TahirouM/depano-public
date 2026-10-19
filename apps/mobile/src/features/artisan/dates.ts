/** Helpers de dates (heure locale de l'appareil, l'app cible Europe/Paris). Semaine du lundi au dimanche. */

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const wd = (x.getDay() + 6) % 7; // lundi = 0
  return addDays(x, -wd);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** YYYY-MM-DD en heure locale. */
export function localDayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Grille d'un mois : 6 semaines × 7 jours (lundi en premier). */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', o);
export const monthLabel = (d: Date) => {
  const s = fmt({ month: 'long', year: 'numeric' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const weekdayShort = (d: Date) => fmt({ weekday: 'short' }).format(d).replace('.', '');
export const dayMonth = (d: Date) => fmt({ day: 'numeric', month: 'short' }).format(d);
export const weekLabel = (start: Date) => `${dayMonth(start)} – ${dayMonth(addDays(start, 6))}`;
export const dayLong = (d: Date) => {
  const s = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const hhmm = (iso: string) =>
  fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** Date « quand » d'une intervention : RDV planifié ou création (urgence). */
export const bookingWhen = (b: { scheduledAt: string | null; createdAt: string }) =>
  b.scheduledAt ?? b.createdAt;

/** Libellé d'une indisponibilité : plage horaire, journée entière ou période (fin exclusive à minuit). */
export function exceptionLabel(e: { startsAt: string; endsAt: string }): string {
  const s = new Date(e.startsAt);
  const end = new Date(e.endsAt);
  const midnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
  if (midnight(s) && midnight(end)) {
    const last = new Date(end.getTime() - 1);
    return localDayKey(s) === localDayKey(last)
      ? `${dayLong(s)} · toute la journée`
      : `Du ${dayLong(s)} au ${dayLong(last)}`;
  }
  if (localDayKey(s) === localDayKey(end))
    return `${dayLong(s)} · ${hhmm(e.startsAt)} – ${hhmm(e.endsAt)}`;
  return `Du ${dayLong(s)} ${hhmm(e.startsAt)} au ${dayLong(end)} ${hhmm(e.endsAt)}`;
}
