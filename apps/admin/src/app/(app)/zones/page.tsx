'use client';

import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { ToneChip } from '@/components/chips';
import { PageHeader } from '@/components/page-header';
import { EmptyState, QueryState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/format';
import { ZoneDialog } from './zone-dialog';

export default function ZonesPage() {
  const q = useQuery({ queryKey: ['zones'], queryFn: () => api.admin.zones() });
  return (
    <>
      <PageHeader
        title="Zones & commissions"
        description="Zones d’intervention ouvertes et taux de commission DEPANO appliqué à la capture."
        actions={
          <ZoneDialog
            trigger={
              <Button>
                <Plus aria-hidden /> Nouvelle zone
              </Button>
            }
          />
        }
      />
      <QueryState query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState title="Aucune zone" description="Créez la zone de Marseille pour démarrer." />}>
        {(zones) => (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead className="text-right">Rayon</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell className="font-medium">{z.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {z.centerLat.toFixed(4)}, {z.centerLng.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(z.radiusKm, 1)} km</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(z.commissionRate)}</TableCell>
                    <TableCell>{z.active ? <ToneChip tone="success">Active</ToneChip> : <ToneChip tone="neutral">Inactive</ToneChip>}</TableCell>
                    <TableCell className="text-right">
                      <ZoneDialog
                        zone={z}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Modifier ${z.name}`}>
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
        )}
      </QueryState>
    </>
  );
}
