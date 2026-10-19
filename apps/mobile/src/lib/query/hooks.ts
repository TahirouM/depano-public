import {
  ACTIVE_BOOKING_STATUSES,
  type BookingDetailDto,
  type BookingListQuery,
  type MessageDto,
  type NotificationDto,
  type NotificationPrefs,
  type NotificationPrefsBody,
  type Paginated,
} from '@depano/schemas';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuthStore, selectIsSignedIn } from '@/stores/auth';
import { qk } from './keys';

/**
 * Requêtes partagées par les deux espaces. Les agents client/artisan ajoutent les leurs
 * dans src/features/<domaine>/queries.ts en réutilisant `qk`.
 */
export function useIsSignedIn() {
  return useAuthStore(selectIsSignedIn);
}

export function useMe() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.me, queryFn: api.me.get, enabled: signedIn, staleTime: 60_000 });
}

/** Préférences de notifications push (serveur : `GET/PUT /me/notification-preferences`). */
export function useNotificationPrefs() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.notificationPrefs, queryFn: api.me.notificationPrefs, enabled: signedIn, staleTime: 5 * 60_000 });
}

/** Mise à jour optimiste d'une préférence (rétablie en cas d'erreur). */
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: NotificationPrefsBody) => api.me.updateNotificationPrefs(b),
    onMutate: async (b) => {
      await qc.cancelQueries({ queryKey: qk.notificationPrefs });
      const previous = qc.getQueryData<NotificationPrefs>(qk.notificationPrefs);
      if (previous) qc.setQueryData<NotificationPrefs>(qk.notificationPrefs, { ...previous, ...b });
      return { previous };
    },
    onError: (_e, _b, c) => {
      if (c?.previous) qc.setQueryData(qk.notificationPrefs, c.previous);
    },
    onSuccess: (prefs) => qc.setQueryData(qk.notificationPrefs, prefs),
  });
}

export function useBadges() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.badges,
    queryFn: api.me.badges,
    enabled: signedIn,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useDomains() {
  return useQuery({ queryKey: qk.catalog.domains, queryFn: api.catalog.domains, staleTime: 60 * 60_000 });
}

export function useBookings(q: Partial<BookingListQuery>) {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.bookings.list(q), queryFn: () => api.bookings.list(q), enabled: signedIn });
}

export function useBooking(id: string | undefined, opts: { refetchInterval?: number | false } = {}) {
  const signedIn = useIsSignedIn();
  return useQuery<BookingDetailDto>({
    queryKey: qk.bookings.detail(id ?? ''),
    queryFn: () => api.bookings.get(id!),
    enabled: signedIn && !!id,
    refetchInterval: opts.refetchInterval,
  });
}

/** Intervention en cours (la plus récente) pour l'espace donné : alimente la barre épinglée. */
export function useActiveBooking(as: 'client' | 'artisan') {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.bookings.active(as),
    queryFn: () => api.bookings.list({ as, scope: 'active', limit: 5 }),
    enabled: signedIn,
    staleTime: 15_000,
    select: (page) => page.items.find((b) => ACTIVE_BOOKING_STATUSES.includes(b.status)) ?? null,
  });
}

export function useConversations() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.chat.conversations, queryFn: api.chat.conversations, enabled: signedIn });
}

export function useMessages(conversationId: string | undefined) {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: qk.chat.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) => api.chat.messages(conversationId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<MessageDto>) => last.nextCursor ?? undefined,
    enabled: signedIn && !!conversationId,
  });
}

export function useNotificationsFeed() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: qk.notifications.list,
    queryFn: ({ pageParam }) => api.notifications.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<NotificationDto>) => last.nextCursor ?? undefined,
    enabled: signedIn,
  });
}

export function useSessions() {
  return useQuery({ queryKey: qk.sessions, queryFn: api.auth.sessions, meta: { persist: false } });
}
