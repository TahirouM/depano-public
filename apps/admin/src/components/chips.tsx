import { DOMAIN_LABELS, type BookingKind, type BookingStatus, type DomainCode } from '@depano/schemas';
import { Siren } from 'lucide-react';
import { ADMIN_BOOKING_STATUS_LABELS, BOOKING_STATUS_TONES, type Tone } from '@/lib/labels';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-info/10 text-info border-info/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  urgent: 'bg-urgent/10 text-urgent border-urgent/30',
  brand: 'bg-secondary text-secondary-foreground border-primary/20',
};

export function ToneChip({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BookingStatusChip({ status }: { status: BookingStatus }) {
  return <ToneChip tone={BOOKING_STATUS_TONES[status]}>{ADMIN_BOOKING_STATUS_LABELS[status]}</ToneChip>;
}

const DOMAIN_DOT: Record<DomainCode, string> = {
  plomberie: 'bg-domain-plomberie',
  electricite: 'bg-domain-electricite',
  energetique: 'bg-domain-energetique',
};

export function DomainChip({ domain }: { domain: DomainCode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <span aria-hidden className={cn('size-2 rounded-full', DOMAIN_DOT[domain])} />
      {DOMAIN_LABELS[domain]}
    </span>
  );
}

export function KindChip({ kind }: { kind: BookingKind }) {
  if (kind === 'urgent')
    return (
      <ToneChip tone="urgent">
        <Siren className="size-3" aria-hidden />
        Urgence
      </ToneChip>
    );
  return <ToneChip tone="brand">Planifiée</ToneChip>;
}
