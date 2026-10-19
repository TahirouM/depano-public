'use client';

import type { ArtisanStatus } from '@depano/schemas';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DomainChip, ToneChip } from '@/components/chips';
import { LoadMore } from '@/components/load-more';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { EmptyState, QueryState } from '@/components/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounced } from '@/hooks/use-debounced';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { ARTISAN_STATUS_LABELS, ARTISAN_STATUS_TONES } from '@/lib/labels';

const TABS: { value: ArtisanStatus | 'all'; label: string }[] = [
  { value: 'pending_review', label: 'À valider' },
  { value: 'approved', label: 'Validés' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'rejected', label: 'Refusés' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'all', label: 'Tous' },
];

export default function ArtisansPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ArtisanStatus | 'all'>('pending_review');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const query = useInfiniteQuery({
    queryKey: ['artisans', status, q],
    queryFn: ({ pageParam }) =>
      api.admin.artisans({ status: status === 'all' ? undefined : status, q: q || undefined, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  return (
    <>
      <PageHeader
        title="Artisans"
        description="Vérification KYC (délai annoncé : 48 h ouvrées), suspension et réintégration."
        actions={<SearchInput value={search} onChange={setSearch} label="Rechercher un artisan" placeholder="Nom, entreprise, SIRET, téléphone" />}
      />
      <Tabs value={status} onValueChange={(v) => setStatus(v as ArtisanStatus | 'all')} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryState
        query={query}
        isEmpty={(d) => d.pages[0]?.items.length === 0}
        empty={
          <EmptyState
            title={status === 'pending_review' ? 'Aucun dossier à valider' : 'Aucun artisan'}
            description={q ? 'Essayez une autre recherche.' : undefined}
          />
        }
      >
        {(data) => (
          <>
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artisan</TableHead>
                    <TableHead>SIRET</TableHead>
                    <TableHead>Métiers</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Note</TableHead>
                    <TableHead className="text-right">Terminées</TableHead>
                    <TableHead>Soumis le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pages.flatMap((p) => p.items).map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/artisans/${a.id}`)}
                    >
                      <TableCell>
                        <Link href={`/artisans/${a.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                          {a.displayName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{a.companyName ?? '—'} · {a.phone ?? 'sans téléphone'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.siret ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {a.domains.map((d) => (
                            <DomainChip key={d} domain={d} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{a.city ?? '—'}</TableCell>
                      <TableCell>
                        <ToneChip tone={ARTISAN_STATUS_TONES[a.status]}>{ARTISAN_STATUS_LABELS[a.status]}</ToneChip>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.ratingAvg ? formatNumber(a.ratingAvg, 1) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.completedCount}</TableCell>
                      <TableCell>{formatDate(a.submittedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <LoadMore {...query} />
          </>
        )}
      </QueryState>
    </>
  );
}
