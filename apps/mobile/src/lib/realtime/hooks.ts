import type { BookingDetailDto, ServerToClientEvents } from '@depano/schemas';
import { useEffect, useRef } from 'react';
import { useBooking } from '../query/hooks';
import { useRealtime } from './RealtimeProvider';

/**
 * Écoute un événement serveur tant que le composant est monté.
 * `useRealtimeEvent('typing', (e) => …)`
 */
export function useRealtimeEvent<E extends keyof ServerToClientEvents>(event: E, handler: ServerToClientEvents[E]) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = ((...args: unknown[]) => (ref.current as (...a: unknown[]) => void)(...args)) as never;
    socket.on(event, fn);
    return () => {
      socket.off(event, fn);
    };
  }, [socket, event]);
}

/**
 * Détail d'une intervention maintenu à jour en direct : rejoint la room `booking:{id}`
 * (statut, position et ETA de l'artisan, vagues de dispatch). Repli en polling (15 s)
 * si le temps réel est coupé.
 */
export function useBookingLive(bookingId: string | undefined) {
  const { socket, connected } = useRealtime();
  const query = useBooking(bookingId, { refetchInterval: connected ? false : 15_000 });

  useEffect(() => {
    if (!socket || !connected || !bookingId) return;
    socket.emit('booking.subscribe', { bookingId }, () => undefined);
    return () => {
      socket.emit('booking.unsubscribe', { bookingId });
    };
  }, [socket, connected, bookingId]);

  return query as typeof query & { data: BookingDetailDto | undefined };
}
