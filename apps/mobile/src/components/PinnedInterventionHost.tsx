import { PinnedInterventionBar, type PinnedInterventionBarProps } from '@depano/ui';
import type { BookingSummaryDto } from '@depano/schemas';
import { router, useSegments, type Href } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
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

export type PinnedIntervention = Pick<PinnedInterventionBarProps, 'status' | 'title' | 'subtitle' | 'perspective' | 'onPress'>;

/**
 * Données de l'intervention épinglée (une seule souscription temps réel par espace),
 * ou null s'il n'y en a pas / si l'on est déjà sur son écran.
 */
export function usePinnedIntervention(as: 'client' | 'artisan'): PinnedIntervention | null {
  const active = useActiveBooking(as);
  const b = active.data ?? null;
  const live = useBookingLive(b?.id);
  const segments = useSegments() as string[];
  // Déjà sur l'écran de l'intervention : inutile de l'épingler.
  const onDetail = segments.includes('[id]') && (segments.includes('activite') || segments.includes('interventions'));
  const status = live.data?.status ?? b?.status;
  const eta = live.data?.etaMinutes;
  return useMemo(() => {
    if (!b || !status || onDetail) return null;
    const who = b.counterpart?.name;
    const subtitle = [who, status === 'en_route' && eta != null ? `arrivée dans ${eta} min` : null].filter(Boolean).join(' · ') || null;
    return {
      status,
      perspective: as,
      title: b.serviceName ?? b.problemReason,
      subtitle,
      onPress: () => router.push(interventionHref({ ...b, status }, as)),
    };
  }, [b, status, eta, onDetail, as]);
}

/** Intervention en cours épinglée au-dessus de la tab bar JS (web). */
export function PinnedInterventionHost({ as }: { as: 'client' | 'artisan' }) {
  const pinned = usePinnedIntervention(as);
  if (!pinned) return null;
  return <PinnedInterventionBar {...pinned} />;
}

/**
 * Tabs natives : l'intervention épinglée est calculée une fois dans la mise en page des onglets,
 * puis affichée soit dans l'accessoire natif iOS 26 (`NativeTabs.BottomAccessory`), soit en bas
 * de chaque pile d'onglet (`TabStack`), juste au-dessus de la tab bar (Android, iOS < 26).
 */
const PinnedCtx = createContext<{ pinned: PinnedIntervention | null; inStack: boolean }>({ pinned: null, inStack: false });

export function PinnedInterventionProvider({ pinned, inStack, children }: { pinned: PinnedIntervention | null; inStack: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ pinned, inStack }), [pinned, inStack]);
  return <PinnedCtx.Provider value={value}>{children}</PinnedCtx.Provider>;
}

/** Intervention à afficher en bas d'une pile d'onglet (null si l'accessoire natif s'en charge). */
export function useStackPinnedIntervention(): PinnedIntervention | null {
  const { pinned, inStack } = useContext(PinnedCtx);
  return inStack ? pinned : null;
}
