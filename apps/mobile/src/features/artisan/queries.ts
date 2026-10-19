import type { ArtisanPrivateProfileDto, BookingDetailDto, UrgentOfferDto } from '@depano/schemas';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useIsSignedIn } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';

/**
 * Requêtes de l'espace artisan. Clés : toujours `qk.artisan.*` / `qk.bookings.*`
 * (invalidation par préfixe depuis les handlers temps réel).
 */

/** Profil privé (KYC, prestations, horaires, documents). */
export function useArtisanProfile(opts: { enabled?: boolean } = {}) {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.artisan.profile,
    queryFn: api.artisan.profile,
    enabled: signedIn && opts.enabled !== false,
    staleTime: 30_000,
    retry: (n, e) => !(e instanceof ApiError && e.status === 403) && n < 2,
  });
}

export function useDashboard() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.artisan.dashboard,
    queryFn: api.artisan.dashboard,
    enabled: signedIn,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/** Offres d'urgence en attente (requiert un profil validé). */
export function useOffers(enabled = true) {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.artisan.offers,
    queryFn: api.artisan.offers,
    enabled: signedIn && enabled,
    staleTime: 5_000,
    meta: { persist: false },
  });
}

/**
 * Une offre par identifiant (`GET /artisan/offers/:id`), quel que soit son statut. Le cache de la liste / du tableau
 * de bord sert de valeur initiale pour un affichage immédiat depuis la notification.
 */
export function useOffer(offerId: string) {
  const signedIn = useIsSignedIn();
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.artisan.offer(offerId),
    queryFn: () => api.artisan.offer(offerId),
    enabled: signedIn && !!offerId,
    initialData: () => findCachedOffer(qc, offerId),
    initialDataUpdatedAt: 0,
    staleTime: 5_000,
    retry: (n, e) => !(e instanceof ApiError && (e.status === 404 || e.status === 403)) && n < 2,
    meta: { persist: false },
  });
}

export function usePlanning(from: string, to: string) {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.artisan.planning(from, to),
    queryFn: () => api.artisan.planning({ from, to }),
    enabled: signedIn,
  });
}

export function useExceptions() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.artisan.exceptions,
    queryFn: api.artisan.exceptions,
    enabled: signedIn,
  });
}

export function useEarnings() {
  const signedIn = useIsSignedIn();
  return useQuery({
    queryKey: qk.artisan.earnings,
    queryFn: api.artisan.earnings,
    enabled: signedIn,
  });
}

export function useStats() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.artisan.stats, queryFn: api.artisan.stats, enabled: signedIn });
}

export function useArtisanReviews() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: qk.artisan.reviews,
    queryFn: ({ pageParam }) => api.artisan.reviews(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: signedIn,
  });
}

/** Liste des interventions artisan sur une période (semaine). */
export function useArtisanBookings(q: {
  from?: string;
  to?: string;
  scope?: 'active' | 'past' | 'all';
  limit?: number;
}) {
  const signedIn = useIsSignedIn();
  const query = {
    as: 'artisan' as const,
    scope: q.scope ?? 'all',
    from: q.from,
    to: q.to,
    limit: q.limit ?? 100,
  };
  return useQuery({
    queryKey: qk.bookings.list(query),
    queryFn: () => api.bookings.list(query),
    enabled: signedIn,
  });
}

/** Mise à jour du profil privé : met le cache à jour avec la réponse serveur. */
export function useProfileMutation<TVars>(fn: (v: TVars) => Promise<ArtisanPrivateProfileDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (p) => {
      qc.setQueryData(qk.artisan.profile, p);
      void qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
    },
  });
}

/** Retrouve une offre dans le cache (liste ou tableau de bord). */
export function findCachedOffer(
  qc: ReturnType<typeof useQueryClient>,
  offerId: string,
): UrgentOfferDto | undefined {
  const list = qc.getQueryData<UrgentOfferDto[]>(qk.artisan.offers);
  const fromList = list?.find((o) => o.id === offerId);
  if (fromList) return fromList;
  const dash = qc.getQueryData<{ pendingOffers: UrgentOfferDto[] }>(qk.artisan.dashboard);
  return dash?.pendingOffers.find((o) => o.id === offerId);
}

/** Remplace le détail d'une intervention dans le cache après une action serveur. */
export function setBookingDetail(qc: ReturnType<typeof useQueryClient>, b: BookingDetailDto) {
  qc.setQueryData(qk.bookings.detail(b.id), b);
  void qc.invalidateQueries({ queryKey: qk.bookings.lists });
  void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
  void qc.invalidateQueries({ queryKey: qk.badges });
}
