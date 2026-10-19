'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ToneChip } from '@/components/chips';
import { LoadMore } from '@/components/load-more';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { EmptyState, QueryState } from '@/components/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounced } from '@/hooks/use-debounced';
import { api } from '@/lib/api';
import { formatDate, fullName } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const query = useInfiniteQuery({
    queryKey: ['users', q],
    queryFn: ({ pageParam }) => api.admin.users({ q: q || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Clients, artisans et équipe. Les comptes supprimés sont anonymisés (factures conservées 10 ans)."
        actions={<SearchInput value={search} onChange={setSearch} label="Rechercher un utilisateur" placeholder="Nom, téléphone, e-mail" />}
      />
      <QueryState
        query={query}
        isEmpty={(d) => d.pages[0]?.items.length === 0}
        empty={<EmptyState title="Aucun utilisateur" description={q ? 'Essayez une autre recherche.' : undefined} />}
      >
        {(data) => (
          <>
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead className="text-right">Interventions</TableHead>
                    <TableHead>Inscrit le</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pages.flatMap((p) => p.items).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{fullName(u)}</TableCell>
                      <TableCell className="whitespace-nowrap">{u.phone ?? '—'}</TableCell>
                      <TableCell>{u.email ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <ToneChip key={r} tone={r === 'admin' || r === 'support' ? 'brand' : 'neutral'}>
                              {ROLE_LABELS[r]}
                            </ToneChip>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.bookingsCount}</TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        {u.deletedAt ? <ToneChip tone="neutral">Supprimé le {formatDate(u.deletedAt)}</ToneChip> : <ToneChip tone="success">Actif</ToneChip>}
                      </TableCell>
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
