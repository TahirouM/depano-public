import { formatEuros } from '@depano/schemas';

export { formatEuros };

const TZ = 'Europe/Paris';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: TZ }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium', timeZone: TZ }).format(new Date(iso));
}

export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: digits }).format(ratio);
}

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
}

/** 125 → « 2 min 05 s ». */
export function formatSeconds(s: number | null | undefined): string {
  if (s === null || s === undefined) return '—';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  if (m === 0) return `${r} s`;
  return `${m} min ${String(r).padStart(2, '0')} s`;
}

/** Durée relative lisible, ex. « 2 h 15 min ». */
export function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

export function fullName(u: { firstName: string | null; lastName: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Sans nom';
}

export function centsToEurosInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** « 12,50 » ou « 12.5 » → 1250. Renvoie null si invalide. */
export function eurosInputToCents(v: string): number | null {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Horodatage à la seconde (preuve en cas de litige). */
export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: TZ,
  }).format(new Date(iso));
}
