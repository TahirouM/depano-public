'use client';

import { DISPUTE_REASON_LABELS } from '@depano/schemas';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, Clock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ToneChip } from '@/components/chips';
import { PageHeader } from '@/components/page-header';
import { ResolveDisputeDialog } from '@/components/resolve-dispute-dialog';
import { EmptyState, QueryState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNow } from '@/hooks/use-now';
import { api } from '@/lib/api';
import { formatDateTime, formatDurationMs, formatEuros } from '@/lib/format';

function SlaCountdown({ dueAt, now }: { dueAt: string; now: number }) {
  const ms = new Date(dueAt).getTime() - now;
  if (ms < 0)
    return (
      <span className="inline-flex items-center gap-1 font-medium text-urgent">
        <AlarmClock className="size-4" aria-hidden /> En retard de {formatDurationMs(ms)}
      </span>
    );
  const soon = ms < 12 * 3_600_000;
  return (
    <span className={soon ? 'inline-flex items-center gap-1 font-medium text-warning' : 'inline-flex items-center gap-1'}>
      <Clock className="size-4" aria-hidden /> Reste {formatDurationMs(ms)}
    </span>
  );
}

export default function DisputesPage() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const now = useNow(30_000);
  const q = useQuery({ queryKey: ['disputes', status], queryFn: () => api.admin.disputes({ status }) });

  return (
    <>
      <PageHeader title="Litiges" description="La capture est gelée tant que le litige est ouvert. Délai de traitement : 72 h." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as 'open' | 'resolved')} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Ouverts</TabsTrigger>
          <TabsTrigger value="resolved">Résolus</TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title={status === 'open' ? 'Aucun litige ouvert' : 'Aucun litige résolu'} description={status === 'open' ? 'Tout est à jour.' : undefined} />}
      >
        {(rows) => {
          const sorted = [...rows].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
          const overdue = status === 'open' ? sorted.filter((r) => new Date(r.dueAt).getTime() < now).length : 0;
          return (
            <>
              {overdue > 0 && (
                <p role="status" className="mb-3 rounded-lg border border-urgent/30 bg-urgent/10 px-3 py-2 text-sm font-medium text-urgent">
                  {overdue} litige(s) hors délai de 72 h.
                </p>
              )}
              <div className="rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intervention</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Artisan</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Ouvert le</TableHead>
                      <TableHead>{status === 'open' ? 'Échéance' : 'Statut'}</TableHead>
                      {status === 'open' && <TableHead className="text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((d) => {
                      const late = status === 'open' && new Date(d.dueAt).getTime() < now;
                      return (
                        <TableRow key={d.id} className={late ? 'bg-urgent/5' : undefined}>
                          <TableCell>
                            <Link href={`/interventions/${d.bookingId}`} className="font-mono text-xs font-medium hover:underline">
                              {d.bookingReference}
                            </Link>
                          </TableCell>
                          <TableCell>{DISPUTE_REASON_LABELS[d.reason]}</TableCell>
                          <TableCell>{d.clientName}</TableCell>
                          <TableCell>{d.artisanName ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEuros(d.amountCents)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateTime(d.createdAt)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {status === 'open' ? (
                              <>
                                <SlaCountdown dueAt={d.dueAt} now={now} />
                                <span className="block text-xs text-muted-foreground">{formatDateTime(d.dueAt)}</span>
                              </>
                            ) : (
                              <ToneChip tone="success">Résolu</ToneChip>
                            )}
                          </TableCell>
                          {status === 'open' && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/interventions/${d.bookingId}`}>Enquêter</Link>
                                </Button>
                                <ResolveDisputeDialog
                                  disputeId={d.id}
                                  reference={d.bookingReference}
                                  amountCents={d.amountCents}
                                  bookingId={d.bookingId}
                                  trigger={<Button size="sm">Trancher</Button>}
                                />
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
