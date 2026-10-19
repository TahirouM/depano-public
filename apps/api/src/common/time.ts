/** Utilitaires de fuseau Europe/Paris sans dépendance (Intl). */
export const TZ = 'Europe/Paris';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function parisParts(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS[p.weekday as string] ?? 0,
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}

/** Décalage (ms) de Paris par rapport à UTC à l'instant donné. */
function offsetAt(utcMs: number) {
  const p = parisParts(new Date(utcMs));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** Convertit une date locale Paris (YYYY-MM-DD + HH:MM) en instant UTC. */
export function parisToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - offsetAt(guess);
  utc = guess - offsetAt(utc);
  return new Date(utc);
}

export const parisDate = (d: Date) => parisParts(d).date;

/** Ajoute n jours à une date YYYY-MM-DD (calendrier, sans fuseau). */
export function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** Début de journée Paris (instant UTC). */
export const parisStartOfDay = (d: Date) => parisToUtc(parisDate(d), '00:00');

export function formatParis(d: Date, opts: Intl.DateTimeFormatOptions = { dateStyle: 'full', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts }).format(d);
}

export const minutes = (n: number) => n * 60_000;
export const hours = (n: number) => n * 3_600_000;
export const days = (n: number) => n * 86_400_000;

/** Distance haversine en km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** ETA naïve : distance à vol d'oiseau à 30 km/h. */
export const naiveEtaMinutes = (km: number) => Math.max(1, Math.round((km / 30) * 60));
