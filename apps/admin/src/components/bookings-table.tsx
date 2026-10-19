'use client';

import type { BookingSummaryDto } from '@depano/schemas';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookingStatusChip, DomainChip, KindChip } from '@/components/chips';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatEuros } from '@/lib/format';

export function BookingsTable({ items, counterpartLabel = 'Contrepartie' }: { items: BookingSummaryDto[]; counterpartLabel?: string }) {
  const router = useRouter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Référence</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Domaine</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Motif</TableHead>
          <TableHead>{counterpartLabel}</TableHead>
          <TableHead>Ville</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Créée le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((b) => (
          <TableRow key={b.id} className="cursor-pointer" onClick={() => router.push(`/interventions/${b.id}`)}>
            <TableCell>
              <Link href={`/interventions/${b.id}`} className="font-mono text-xs font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                {b.reference}
              </Link>
            </TableCell>
            <TableCell>
              <KindChip kind={b.kind} />
            </TableCell>
            <TableCell>
              <DomainChip domain={b.domain} />
            </TableCell>
            <TableCell>
              <BookingStatusChip status={b.status} />
            </TableCell>
            <TableCell className="max-w-48 truncate" title={b.problemReason}>
              {b.serviceName ?? b.problemReason}
            </TableCell>
            <TableCell>{b.counterpart?.name ?? '—'}</TableCell>
            <TableCell>{b.city}</TableCell>
            <TableCell className="text-right tabular-nums">{formatEuros(b.totalCents)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(b.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
