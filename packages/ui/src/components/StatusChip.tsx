import type { BookingStatus } from '@depano/schemas';
import { Chip } from './Chip';
import { bookingStatusMeta, type Perspective } from './meta';

export interface StatusChipProps {
  status: BookingStatus;
  /** Les libellés changent selon qui regarde (« Annulée par vous »…). */
  perspective?: Perspective;
  size?: 'sm' | 'md';
}

/** Statut d'intervention : couleur + icône + libellé (jamais la couleur seule). */
export function StatusChip({ status, perspective = 'client', size = 'md' }: StatusChipProps) {
  const m = bookingStatusMeta(status, perspective);
  return <Chip label={m.label} icon={m.icon} tone={m.tone} size={size} accessibilityLabel={`Statut : ${m.label}`} />;
}
