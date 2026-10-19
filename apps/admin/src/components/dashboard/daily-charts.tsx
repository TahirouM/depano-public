'use client';

import type { AdminMetricsDto } from '@depano/schemas';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEuros, formatNumber } from '@/lib/format';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' });
const day = (d: string) => dayFmt.format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
const longDay = (d: string) => longFmt.format(new Date(`${d.slice(0, 10)}T00:00:00Z`));

const axis = { stroke: 'var(--muted-foreground)', fontSize: 12, tickLine: false, axisLine: false } as const;

function ChartTooltip({
  active,
  payload,
  label,
  format,
  name,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  format: (v: number) => string;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="text-xs text-muted-foreground">{longDay(String(label))}</p>
      <p className="font-medium tabular-nums">
        {name} : {format(Number(payload[0]?.value ?? 0))}
      </p>
    </div>
  );
}

/**
 * Deux graphiques séparés (pas de double axe) : volume d'interventions et GMV par jour.
 */
export function DailyCharts({ daily }: { daily: AdminMetricsDto['daily'] }) {
  const data = daily.map((d) => ({ ...d, gmv: d.gmvCents / 100 }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <figure className="rounded-xl border bg-card p-4">
        <figcaption className="mb-3 text-sm font-medium">Interventions créées par jour</figcaption>
        <div className="h-56" role="img" aria-label="Histogramme des interventions par jour (détail dans le tableau ci-dessous)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={day} {...axis} minTickGap={16} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                content={<ChartTooltip name="Interventions" format={(v) => formatNumber(v, 0)} />}
              />
              <Bar dataKey="bookings" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure className="rounded-xl border bg-card p-4">
        <figcaption className="mb-3 text-sm font-medium">Volume d’affaires (GMV) par jour</figcaption>
        <div className="h-56" role="img" aria-label="Courbe du volume d'affaires par jour (détail dans le tableau ci-dessous)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={day} {...axis} minTickGap={16} />
              <YAxis {...axis} width={56} tickFormatter={(v: number) => `${formatNumber(v, 0)} €`} />
              <Tooltip
                cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                content={<ChartTooltip name="GMV" format={(v) => formatEuros(Math.round(v * 100))} />}
              />
              <Line
                type="monotone"
                dataKey="gmv"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
