import type { AdminMetricsDto } from '@depano/schemas';
import { formatNumber, formatPercent, formatSeconds } from '@/lib/format';

/** Indicateurs et cibles MVP (plan, section 11). Les taux sont des ratios 0–1. */
export interface KpiDef {
  key: keyof Pick<
    AdminMetricsDto,
    | 'urgentTakeRate'
    | 'medianAcceptanceSeconds'
    | 'urgentFunnelConversion'
    | 'codeClosureRate'
    | 'disputeRate'
    | 'ratingAvg'
    | 'clientRecurrence'
    | 'bookingsPerActiveArtisanWeek'
  >;
  label: string;
  measures: string;
  targetLabel: string;
  meets: (v: number) => boolean;
  format: (v: number | null) => string;
}

export const KPIS: KpiDef[] = [
  {
    key: 'urgentTakeRate',
    label: 'Prise en charge urgence',
    measures: 'Urgences acceptées / urgences envoyées',
    targetLabel: '> 85 %',
    meets: (v) => v > 0.85,
    format: (v) => formatPercent(v),
  },
  {
    key: 'medianAcceptanceSeconds',
    label: "Délai d'acceptation médian",
    measures: 'Du paiement à « Acceptée »',
    targetLabel: '< 3 min',
    meets: (v) => v < 180,
    format: formatSeconds,
  },
  {
    key: 'urgentFunnelConversion',
    label: 'Conversion tunnel urgence',
    measures: 'Tap « Urgence » → empreinte validée',
    targetLabel: '> 40 %',
    meets: (v) => v > 0.4,
    format: (v) => formatPercent(v),
  },
  {
    key: 'codeClosureRate',
    label: 'Clôture par code',
    measures: 'Codes saisis / interventions terminées',
    targetLabel: '> 95 %',
    meets: (v) => v > 0.95,
    format: (v) => formatPercent(v),
  },
  {
    key: 'disputeRate',
    label: 'Taux de litige',
    measures: 'Litiges / interventions',
    targetLabel: '< 3 %',
    meets: (v) => v < 0.03,
    format: (v) => formatPercent(v),
  },
  {
    key: 'ratingAvg',
    label: 'Note moyenne',
    measures: 'Avis clients',
    targetLabel: '≥ 4,5 / 5',
    meets: (v) => v >= 4.5,
    format: (v) => (v === null ? '—' : `${formatNumber(v, 2)} / 5`),
  },
  {
    key: 'clientRecurrence',
    label: 'Récurrence client',
    measures: '2e intervention sous 6 mois',
    targetLabel: '> 25 %',
    meets: (v) => v > 0.25,
    format: (v) => formatPercent(v),
  },
  {
    key: 'bookingsPerActiveArtisanWeek',
    label: 'Activité artisan',
    measures: 'Interventions / artisan actif / semaine',
    targetLabel: '≥ 5',
    meets: (v) => v >= 5,
    format: (v) => formatNumber(v, 1),
  },
];
