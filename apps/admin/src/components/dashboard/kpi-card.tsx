import { CircleAlert, CircleCheck, CircleDashed } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { KpiDef } from '@/lib/kpis';
import { cn } from '@/lib/utils';

export function KpiCard({ def, value }: { def: KpiDef; value: number | null }) {
  const state = value === null ? 'none' : def.meets(value) ? 'ok' : 'below';
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium">{def.label}</h3>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
              state === 'ok' && 'border-success/30 bg-success/10 text-success',
              state === 'below' && 'border-warning/30 bg-warning/10 text-warning',
              state === 'none' && 'border-border bg-muted text-muted-foreground',
            )}
          >
            {state === 'ok' && <CircleCheck className="size-3" aria-hidden />}
            {state === 'below' && <CircleAlert className="size-3" aria-hidden />}
            {state === 'none' && <CircleDashed className="size-3" aria-hidden />}
            {state === 'ok' ? 'Objectif atteint' : state === 'below' ? 'Sous l’objectif' : 'Pas de données'}
          </span>
        </div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{def.format(value)}</p>
        <p className="mt-auto text-xs text-muted-foreground">
          {def.measures} · Cible MVP <span className="font-medium text-foreground">{def.targetLabel}</span>
        </p>
      </CardContent>
    </Card>
  );
}
