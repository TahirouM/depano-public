'use client';

import { BOOKING_KINDS, BOOKING_STATUSES, type BookingKind, type BookingStatus } from '@depano/schemas';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BookingsTable } from '@/components/bookings-table';
import { LoadMore } from '@/components/load-more';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { EmptyState, QueryState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounced } from '@/hooks/use-debounced';
import { api } from '@/lib/api';
import { ADMIN_BOOKING_STATUS_LABELS } from '@/lib/labels';

const KIND_LABELS: Record<BookingKind, string> = { urgent: 'Urgence', scheduled: 'Planifiée' };

export default function InterventionsPage() {
  const [status, setStatus] = useState<BookingStatus | 'all'>('all');
  const [kind, setKind] = useState<BookingKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const query = useInfiniteQuery({
    queryKey: ['bookings', status, kind, q],
    queryFn: ({ pageParam }) =>
      api.admin.bookings({
        status: status === 'all' ? undefined : status,
        kind: kind === 'all' ? undefined : kind,
        q: q || undefined,
        cursor: pageParam,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const filtered = status !== 'all' || kind !== 'all' || !!q;

  return (
    <>
      <PageHeader title="Interventions" description="Toutes les réservations et urgences, du paiement à la clôture." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={setSearch} label="Rechercher par référence" placeholder="Référence (ex. DEP-…)" />
        <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filtrer par statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ADMIN_BOOKING_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(v) => setKind(v as BookingKind | 'all')}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrer par type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {BOOKING_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setStatus('all');
              setKind('all');
              setSearch('');
            }}
          >
            Réinitialiser
          </Button>
        )}
      </div>
      <QueryState
        query={query}
        isEmpty={(d) => d.pages[0]?.items.length === 0}
        empty={<EmptyState title="Aucune intervention" description={filtered ? 'Aucun résultat pour ces filtres.' : undefined} />}
      >
        {(data) => (
          <>
            <div className="rounded-xl border bg-card">
              <BookingsTable items={data.pages.flatMap((p) => p.items)} />
            </div>
            <LoadMore {...query} />
          </>
        )}
      </QueryState>
    </>
  );
}
