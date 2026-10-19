import { PinnedInterventionBar } from '@depano/ui';
import type { BookingSummaryDto } from '@depano/schemas';
import { router, useSegments, type Href } from 'expo-router';
import { useActiveBooking } from '@/lib/query/hooks';
import { useBookingLive } from '@/lib/realtime/hooks';

/** Route de suivi d'une intervention selon l'espace et le statut. */
export function interventionHref(b: Pick<BookingSummaryDto, 'id' | 'kind' | 'status'>, as: 'client' | 'artisan'): Href {
  if (as === 'artisan') return { pathname: '/pro/interventions/[id]', params: { id: b.id } };
  if (b.kind === 'urgent' && b.status === 'searching') return { pathname: '/urgence/[bookingId]/recherche', params: { bookingId: b.id } };
  if (b.kind === 'urgent' && (b.status === 'accepted' || b.status === 'en_route')) {
    return { pathname: '/urgence/[bookingId]/suivi', params: { bookingId: b.id } };
  }
  return { pathname: '/activite/[id]', params: { id: b.id } };
}

/** Intervention en cours épinglée au-dessus de la tab bar (tous les onglets). */
export function PinnedInterventionHost({ as }: { as: 'client' | 'artisan' }) {
  const active = useActiveBooking(as);
  const b = active.data ?? null;
  const live = useBookingLive(b?.id);
  const segments = useSegments() as string[];
  if (!b) return null;
  // Déjà sur l'écran de l'intervention : inutile de l'épingler.
  if (segments.includes('[id]') && (segments.includes('activite') || segments.includes('interventions'))) return null;

  const status = live.data?.status ?? b.status;
  const eta = live.data?.etaMinutes;
  const who = b.counterpart?.name;
  const subtitle = [who, status === 'en_route' && eta != null ? `arrivée dans ${eta} min` : null].filter(Boolean).join(' · ') || null;
  return (
    <PinnedInterventionBar
      status={status}
      perspective={as}
      title={b.serviceName ?? b.problemReason}
      subtitle={subtitle}
      onPress={() => router.push(interventionHref({ ...b, status }, as))}
    />
  );
}
