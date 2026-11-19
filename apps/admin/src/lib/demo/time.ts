const DAY_MS = 86_400_000;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const shiftDay = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Décale de N jours entiers toutes les dates d'un enregistrement (valeurs et clés de requête), N étant
 * le nombre de jours écoulés depuis l'enregistrement : un rendez-vous « demain 9 h » le reste, à la même heure.
 */
export function shiftDates<T>(data: T, recordedAt: string, now: Date = new Date()): T {
  const days = Math.round((now.getTime() - new Date(recordedAt).getTime()) / DAY_MS);
  if (!days) return structuredClone(data);
  const shiftString = (s: string): string => {
    if (ISO_DATETIME.test(s)) return new Date(new Date(s).getTime() + days * DAY_MS).toISOString();
    if (ISO_DATE.test(s)) return shiftDay(s, days);
    return s;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return shiftString(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(data) as T;
}
