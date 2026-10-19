'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Gavel, HardHat } from 'lucide-react';
import { DailyCharts } from '@/components/dashboard/daily-charts';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PageHeader } from '@/components/page-header';
import { BlockSkeleton, ErrorState } from '@/components/states';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatEuros, formatNumber } from '@/lib/format';
import { KPIS } from '@/lib/kpis';

const PERIODS = {
  '7': '7 derniers jours',
  '30': '30 derniers jours',
  '90': '90 derniers jours',
  month: 'Mois en cours',
  '365': '12 derniers mois',
} as const;
type Period = keyof typeof PERIODS;

function range(p: Period) {
  const to = new Date();
  const from = new Date(to);
  if (p === 'month') from.setDate(1);
  else from.setDate(from.getDate() - Number(p));
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function Total({ label, value, href, icon }: { label: string; value: string; href?: string; icon?: React.ReactNode }) {
  const body = (
    <CardContent className="flex items-center justify-between gap-2 p-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
      </div>
      {icon}
    </CardContent>
  );
  return (
    <Card className="gap-0 py-0">
      {href ? (
        <Link href={href} className="rounded-xl outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30');
  const q = useMemo(() => range(period), [period]);
  const metrics = useQuery({ queryKey: ['metrics', period], queryFn: () => api.admin.metrics(q) });

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Indicateurs du MVP Marseille et leurs cibles (plan, section 11)."
        actions={
          <div className="grid gap-1">
            <label htmlFor="period" className="sr-only">
              Période
            </label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger id="period" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {metrics.isPending ? (
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <BlockSkeleton key={i} className="h-36" />
            ))}
          </div>
          <BlockSkeleton className="h-72" />
        </div>
      ) : metrics.isError ? (
        <ErrorState error={metrics.error} onRetry={() => metrics.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <p className="text-sm text-muted-foreground">
            Du {formatDate(metrics.data.period.from)} au {formatDate(metrics.data.period.to)}
          </p>
          <section aria-labelledby="kpis-title">
            <h2 id="kpis-title" className="sr-only">
              Indicateurs clés
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {KPIS.map((k) => (
                <KpiCard key={k.key} def={k} value={metrics.data[k.key]} />
              ))}
            </div>
          </section>

          <section aria-labelledby="totals-title">
            <h2 id="totals-title" className="mb-3 text-lg font-semibold">
              Totaux de la période
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <Total label="Interventions" value={formatNumber(metrics.data.totals.bookings, 0)} />
              <Total label="Clôturées" value={formatNumber(metrics.data.totals.closed, 0)} />
              <Total label="GMV" value={formatEuros(metrics.data.totals.gmvCents)} />
              <Total label="Commissions" value={formatEuros(metrics.data.totals.commissionCents)} />
              <Total label="Artisans actifs" value={formatNumber(metrics.data.totals.activeArtisans, 0)} />
              <Total
                label="Artisans à valider"
                value={formatNumber(metrics.data.totals.pendingArtisans, 0)}
                href="/artisans"
                icon={<HardHat className="size-5 text-warning" aria-hidden />}
              />
              <Total
                label="Litiges ouverts"
                value={formatNumber(metrics.data.totals.openDisputes, 0)}
                href="/litiges"
                icon={<Gavel className="size-5 text-urgent" aria-hidden />}
              />
            </div>
          </section>

          <section aria-labelledby="daily-title" className="grid gap-3">
            <h2 id="daily-title" className="text-lg font-semibold">
              Activité quotidienne
            </h2>
            {metrics.data.daily.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Aucune activité sur la période.
              </p>
            ) : (
              <>
                <DailyCharts daily={metrics.data.daily} />
                <details className="rounded-xl border bg-card p-4 text-sm">
                  <summary className="cursor-pointer font-medium">Voir les données en tableau</summary>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jour</TableHead>
                        <TableHead className="text-right">Interventions</TableHead>
                        <TableHead className="text-right">GMV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.data.daily.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell>{formatDate(d.date)}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.bookings}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEuros(d.gmvCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
