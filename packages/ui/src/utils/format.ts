/** Formatages FR partagés (dates en Europe/Paris). */
const TZ = 'Europe/Paris';

export function formatTime(iso: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
}

export function formatDayShort(iso: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: TZ }).format(new Date(iso));
}

export function formatDateLong(iso: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** Clé YYYY-MM-DD dans le fuseau Europe/Paris. */
export function dayKey(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ }).format(new Date(iso));
  return parts;
}

/** « Aujourd'hui », « Hier », « Demain » ou « lundi 12 octobre ». */
export function relativeDayLabel(iso: string | Date, now: Date = new Date()): string {
  const k = dayKey(iso);
  const today = dayKey(now);
  const y = dayKey(new Date(now.getTime() - 86_400_000));
  const t = dayKey(new Date(now.getTime() + 86_400_000));
  if (k === today) return "Aujourd'hui";
  if (k === y) return 'Hier';
  if (k === t) return 'Demain';
  const s = formatDateLong(iso);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Heure si aujourd'hui, sinon jour court (listes de conversations). */
export function formatShortTimestamp(iso: string, now: Date = new Date()): string {
  return dayKey(iso) === dayKey(now) ? formatTime(iso) : relativeDayLabel(iso, now) === 'Hier' ? 'Hier' : formatDayShort(iso);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

export function formatRating(r: number | null | undefined): string | null {
  return r == null ? null : r.toFixed(1).replace('.', ',');
}
