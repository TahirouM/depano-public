import * as Location from 'expo-location';
import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';
import { useActiveBooking } from '@/lib/query/hooks';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';

/** Intervalle d'envoi de la position pendant le trajet. */
export const LOCATION_INTERVAL_MS = 10_000;

export type TrackingState = 'idle' | 'starting' | 'sharing' | 'denied' | 'unavailable';

interface TrackingStore {
  bookingId: string | null;
  state: TrackingState;
  lastSentAt: number | null;
  last: { lat: number; lng: number } | null;
  set: (p: Partial<Omit<TrackingStore, 'set'>>) => void;
}

/** État du partage de position (affiché dans le détail de l'intervention). */
export const useTrackingStore = create<TrackingStore>((set) => ({
  bookingId: null,
  state: 'idle',
  lastSentAt: null,
  last: null,
  set: (p) => set(p),
}));

/** Distance en km (haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Partage de position au premier plan tant qu'une intervention est « en route » :
 * expo-location (watchPositionAsync) + envoi toutes les ~10 s via Socket.IO
 * (`location.update`), repli REST (`bookings.updateLocation`) si le temps réel est coupé.
 * Monté une fois dans la mise en page des onglets artisan.
 */
export function useEnRouteTracking() {
  const active = useActiveBooking('artisan');
  const { socket, connected } = useRealtime();
  const bookingId = active.data?.status === 'en_route' ? active.data.id : null;
  const set = useTrackingStore((s) => s.set);

  useEffect(() => {
    if (!bookingId) {
      set({ bookingId: null, state: 'idle', last: null });
      return;
    }
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    let last: Location.LocationObjectCoords | null = null;

    const send = () => {
      if (!last) return;
      const body = {
        lat: last.latitude,
        lng: last.longitude,
        ...(last.heading != null && last.heading >= 0 && last.heading <= 360
          ? { heading: last.heading }
          : {}),
        ...(last.speed != null && last.speed >= 0 ? { speed: last.speed } : {}),
      };
      if (socket && connected) socket.emit('location.update', { bookingId, ...body });
      else void api.bookings.updateLocation(bookingId, body).catch(() => undefined);
      set({ lastSentAt: Date.now(), last: { lat: body.lat, lng: body.lng } });
    };

    set({ bookingId, state: 'starting' });
    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) set({ state: 'denied' });
          return;
        }
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_INTERVAL_MS,
            distanceInterval: 25,
          },
          (pos) => {
            const first = !last;
            last = pos.coords;
            if (first) send();
          },
        );
        if (cancelled) sub.remove();
        else set({ state: 'sharing' });
      } catch {
        if (!cancelled) set({ state: 'unavailable' });
      }
    })();
    // Envoi régulier même à l'arrêt (feu rouge) : le client voit que l'artisan est toujours là.
    const timer = setInterval(() => {
      if (last) send();
    }, LOCATION_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      sub?.remove();
    };
  }, [bookingId, socket, connected, set]);
}

/** Composant sans rendu qui active le partage de position (à placer dans un layout). */
export function EnRouteTracker() {
  useEnRouteTracking();
  return null;
}
