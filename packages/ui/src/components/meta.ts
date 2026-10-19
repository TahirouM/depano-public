import {
  Ban,
  Car,
  CircleCheck,
  CircleX,
  Clock,
  CreditCard,
  DoorOpen,
  Droplets,
  FileText,
  Flame,
  Hammer,
  Hourglass,
  KeyRound,
  Scale,
  Search,
  UserCheck,
  Zap,
} from 'lucide-react-native';
import { BOOKING_STATUS_LABELS, DOMAIN_LABELS, type BookingStatus, type DomainCode } from '@depano/schemas';
import type { Tone } from '../tokens/colors';
import type { LucideIcon } from './Icon';

export const DOMAIN_ICONS: Record<DomainCode, LucideIcon> = {
  plomberie: Droplets,
  electricite: Zap,
  energetique: Flame,
};

export { DOMAIN_LABELS };

export type Perspective = 'client' | 'artisan';

export interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

const STATUS_STYLE: Record<BookingStatus, { tone: Tone; icon: LucideIcon }> = {
  pending_payment: { tone: 'warning', icon: CreditCard },
  searching: { tone: 'info', icon: Search },
  accepted: { tone: 'info', icon: UserCheck },
  en_route: { tone: 'info', icon: Car },
  arrived: { tone: 'info', icon: DoorOpen },
  quote_pending: { tone: 'warning', icon: FileText },
  in_progress: { tone: 'brand', icon: Hammer },
  awaiting_code: { tone: 'warning', icon: KeyRound },
  closed: { tone: 'success', icon: CircleCheck },
  cancelled_by_client: { tone: 'neutral', icon: CircleX },
  cancelled_by_artisan: { tone: 'neutral', icon: CircleX },
  expired: { tone: 'neutral', icon: Ban },
  disputed: { tone: 'danger', icon: Scale },
};

/** Libellés vus par l'artisan quand ils diffèrent de ceux du client. */
const ARTISAN_LABELS: Partial<Record<BookingStatus, string>> = {
  pending_payment: 'Paiement client en attente',
  searching: 'En attente d\'acceptation',
  en_route: 'En route',
  arrived: 'Sur place',
  quote_pending: 'Devis envoyé',
  awaiting_code: 'Code de fin à saisir',
  cancelled_by_client: 'Annulée par le client',
  cancelled_by_artisan: 'Annulée par vous',
  expired: 'Expirée',
};

export function bookingStatusMeta(status: BookingStatus, perspective: Perspective = 'client'): StatusMeta {
  const s = STATUS_STYLE[status];
  const label = (perspective === 'artisan' ? ARTISAN_LABELS[status] : undefined) ?? BOOKING_STATUS_LABELS[status];
  return { label, tone: s.tone, icon: s.icon ?? Clock };
}
