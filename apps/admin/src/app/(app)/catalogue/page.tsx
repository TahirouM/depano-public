'use client';

import { DOMAIN_CODES, DOMAIN_LABELS, type DomainCode } from '@depano/schemas';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { DomainChip, ToneChip } from '@/components/chips';
import { PageHeader } from '@/components/page-header';
import { EmptyState, QueryState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatEuros } from '@/lib/format';
import { SERVICE_KIND_LABELS } from '@/lib/labels';
import { ServiceDialog } from './service-dialog';

export default function CataloguePage() {
  const [domain, setDomain] = useState<DomainCode | 'all'>('all');
  const q = useQuery({ queryKey: ['services'], queryFn: () => api.admin.services() });

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="Domaines et prestations proposés aux clients, avec prix indicatifs du marché."
        actions={
          <ServiceDialog
            trigger={
              <Button>
                <Plus aria-hidden /> Nouvelle prestation
              </Button>
            }
          />
        }
      />
      <Tabs value={domain} onValueChange={(v) => setDomain(v as DomainCode | 'all')} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">Tous</TabsTrigger>
          {DOMAIN_CODES.map((d) => (
            <TabsTrigger key={d} value={d}>
              {DOMAIN_LABELS[d]}
              {q.data && <span className="text-muted-foreground"> ({q.data.filter((s) => s.domain === d).length})</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Catalogue vide" description="Créez la première prestation." />}>
        {(services) => {
          const rows = services
            .filter((s) => domain === 'all' || s.domain === domain)
            .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name, 'fr'));
          if (rows.length === 0) return <EmptyState title="Aucune prestation dans ce domaine" />;
          return (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestation</TableHead>
                    <TableHead>Domaine</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Urgence</TableHead>
                    <TableHead className="text-right">Prix de référence</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id} className={s.active ? undefined : 'opacity-70'}>
                      <TableCell>
                        <span className="font-medium">{s.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{s.slug}</span>
                      </TableCell>
                      <TableCell>
                        <DomainChip domain={s.domain} />
                      </TableCell>
                      <TableCell>{SERVICE_KIND_LABELS[s.kind]}</TableCell>
                      <TableCell>{s.urgentEligible ? <ToneChip tone="urgent">Oui</ToneChip> : 'Non'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEuros(s.referencePriceCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.defaultDurationMinutes} min</TableCell>
                      <TableCell>{s.active ? <ToneChip tone="success">Active</ToneChip> : <ToneChip tone="neutral">Inactive</ToneChip>}</TableCell>
                      <TableCell className="text-right">
                        <ServiceDialog
                          service={s}
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${s.name}`}>
                              <Pencil aria-hidden />
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        }}
      </QueryState>
    </>
  );
}
