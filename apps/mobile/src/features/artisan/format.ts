import type { EarningsDto } from '@depano/schemas';

/** Helpers purs de l'espace artisan (sans dépendance React Native : testés avec Vitest). */

/** « 90 », « 90,5 », « 90.50 € » → centimes (null si invalide). */
export function parseEuros(v: string): number | null {
  const s = v.replace(/[€\s]/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** Centimes → saisie (« 90 », « 90,50 »). */
export function centsToInput(c: number | undefined | null): string {
  if (c == null) return '';
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',');
}

/** « 31/12/2027 » → « 2027-12-31 » (null si invalide). */
export function parseFrDate(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo}-${d}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export interface Rule {
  weekday: number;
  start: string;
  end: string;
}

/** Ordre d'affichage : lundi → dimanche (weekday 0 = dimanche, comme l'API). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

export const DEFAULT_RULES: Rule[] = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start: '08:00', end: '12:00' },
  { weekday, start: '14:00', end: '19:00' },
]);

/** Erreur lisible si une plage est invalide (fin avant début, chevauchement). */
export function rulesError(rules: Rule[]): string | null {
  for (const d of WEEK_ORDER) {
    const day = rules.filter((r) => r.weekday === d).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < day.length; i++) {
      const r = day[i]!;
      if (r.start >= r.end)
        return `${WEEKDAY_LABELS[d]} : la fin (${r.end}) doit être après le début (${r.start}).`;
      const next = day[i + 1];
      if (next && next.start < r.end) return `${WEEKDAY_LABELS[d]} : deux plages se chevauchent.`;
    }
  }
  return null;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',');

/** Export comptable : une ligne par intervention (séparateur « ; », montants en euros). */
export function earningsCsv(e: Pick<EarningsDto, 'lines'>): string {
  const head = [
    'Date',
    'Référence',
    'Montant encaissé TTC (€)',
    'Commission DEPANO (€)',
    'Net (€)',
  ];
  const rows = e.lines.map((l) => [
    l.date.slice(0, 10),
    l.reference,
    euros(l.grossCents),
    euros(l.commissionCents),
    euros(l.netCents),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
}

/** Ajoute n jours ouvrés (lun.–ven.). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}
