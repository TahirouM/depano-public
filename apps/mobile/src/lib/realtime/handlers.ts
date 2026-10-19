import type { BookingDetailDto, ConversationDto, ServerToClientEvents } from '@depano/schemas';
import type { QueryClient } from '@tanstack/react-query';
import { useOutboxStore } from '@/stores/outbox';
import { prependNotificationInCache, upsertMessageInCache } from '../query/cache';
import { qk } from '../query/keys';

type Handlers = { [K in keyof ServerToClientEvents]: ServerToClientEvents[K] };

/**
 * Événements temps réel → cache TanStack Query. On met à jour directement quand
 * l'événement porte la donnée, sinon on invalide (refetch ciblé).
 */
export function createRealtimeHandlers(qc: QueryClient, hooks: { onOffer?: (offerId: string) => void } = {}): Handlers {
  const patchBooking = (id: string, patch: Partial<BookingDetailDto>) =>
    qc.setQueryData<BookingDetailDto>(qk.bookings.detail(id), (old) => (old ? { ...old, ...patch } : old));

  return {
    'booking.updated': (e) => {
      patchBooking(e.bookingId, { status: e.status });
      void qc.invalidateQueries({ queryKey: qk.bookings.detail(e.bookingId) });
      void qc.invalidateQueries({ queryKey: qk.bookings.lists });
      void qc.invalidateQueries({ queryKey: qk.badges });
      void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
    },
    'booking.location': (e) => {
      patchBooking(e.bookingId, { artisanLocation: { lat: e.lat, lng: e.lng }, etaMinutes: e.etaMinutes });
    },
    'booking.dispatch': (e) => {
      patchBooking(e.bookingId, { dispatch: { wave: e.wave, contacted: e.contacted, radiusKm: e.radiusKm } });
    },
    'message.created': (m) => {
      upsertMessageInCache(qc, m);
      if (m.clientId) useOutboxStore.getState().remove(m.conversationId, m.clientId);
      qc.setQueryData<ConversationDto[]>(qk.chat.conversations, (old) =>
        old?.map((c) => (c.id === m.conversationId ? { ...c, lastMessage: m, updatedAt: m.createdAt } : c)),
      );
      void qc.invalidateQueries({ queryKey: qk.chat.conversations });
      void qc.invalidateQueries({ queryKey: qk.badges });
    },
    'message.read': (e) => {
      void qc.invalidateQueries({ queryKey: qk.chat.messages(e.conversationId) });
    },
    typing: () => undefined, // écouté localement par l'écran de chat (useRealtimeEvent)
    'notification.created': (n) => {
      prependNotificationInCache(qc, n);
      void qc.invalidateQueries({ queryKey: qk.badges });
    },
    'offer.created': (o) => {
      void qc.invalidateQueries({ queryKey: qk.artisan.offers });
      void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
      hooks.onOffer?.(o.id);
    },
    'offer.revoked': () => {
      void qc.invalidateQueries({ queryKey: qk.artisan.offers });
      void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
    },
  };
}
