import type {
  AddressDto,
  AddressSuggestion,
  ArtisanCardDto,
  ArtisanSearchQuery,
  EstimateBody,
  ReviewDto,
  Paginated,
} from '@depano/schemas';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@depano/ui';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useIsSignedIn } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { optimistic } from '@/lib/query/optimistic';

/** Requêtes de l'espace client (catalogue, carnet d'adresses, favoris, paiement, factures). */

export function useArtisanSearch(q: Partial<ArtisanSearchQuery>, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.catalog.search(q),
    queryFn: () => api.catalog.searchArtisans(q),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: opts.enabled ?? true,
  });
}

export function useArtisanSearchInfinite(q: Partial<ArtisanSearchQuery>) {
  return useInfiniteQuery({
    queryKey: [...qk.catalog.search(q), 'infinite'],
    queryFn: ({ pageParam }) => api.catalog.searchArtisans({ ...q, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<ArtisanCardDto>) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useArtisan(id: string | undefined, near?: { lat: number; lng: number } | null) {
  return useQuery({
    queryKey: [...qk.catalog.artisan(id ?? ''), near ?? null],
    queryFn: () => api.catalog.artisan(id!, near ?? undefined),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useArtisanReviews(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: qk.catalog.reviews(id ?? ''),
    queryFn: ({ pageParam }) => api.catalog.reviews(id!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<ReviewDto>) => last.nextCursor ?? undefined,
    enabled: !!id,
  });
}

export function useSlots(artisanId: string | undefined, serviceId?: string, days = 14) {
  const q = { serviceId, days };
  return useQuery({
    queryKey: qk.catalog.slots(artisanId ?? '', q),
    queryFn: () => api.catalog.slots(artisanId!, q),
    enabled: !!artisanId,
    staleTime: 30_000,
    // Les créneaux bougent vite : jamais de cache hors ligne trompeur.
    meta: { persist: false },
  });
}

export function useEstimate(body: Partial<EstimateBody> | null) {
  return useQuery({
    queryKey: qk.catalog.estimate(body ?? {}),
    queryFn: () => api.catalog.estimate(body as EstimateBody),
    enabled: !!body?.domain,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/** Valeur « stabilisée » après `ms` sans changement (autocomplétion). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function useAddressSearch(text: string, near?: { lat: number; lng: number }) {
  const q = useDebounced(text.trim(), 300);
  return useQuery<AddressSuggestion[]>({
    queryKey: qk.catalog.address(q),
    queryFn: () => api.catalog.searchAddress(q, near),
    enabled: q.length >= 3,
    staleTime: 5 * 60_000,
    meta: { persist: false },
  });
}

export function useAddresses() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.addresses, queryFn: api.me.addresses, enabled: signedIn });
}

export function useFavorites() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.favorites, queryFn: api.me.favorites, enabled: signedIn });
}

/** Ajout / retrait d'un favori, en optimiste. */
export function useToggleFavorite() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ artisan, favorite }: { artisan: ArtisanCardDto; favorite: boolean }) =>
      favorite ? api.me.addFavorite(artisan.id) : api.me.removeFavorite(artisan.id),
    ...optimistic<ArtisanCardDto[], { artisan: ArtisanCardDto; favorite: boolean }>(qc, {
      queryKey: () => qk.favorites,
      update: (old, { artisan, favorite }) => {
        const rest = (old ?? []).filter((a) => a.id !== artisan.id);
        return favorite ? [artisan, ...rest] : rest;
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  });
}

export function usePaymentMethods() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.paymentMethods, queryFn: api.me.paymentMethods, enabled: signedIn, meta: { persist: false } });
}

export function useInvoices() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.invoices, queryFn: api.me.invoices, enabled: signedIn });
}

/** Parrainage : code, crédits disponibles, historique (compte requis). */
export function useReferral() {
  const signedIn = useIsSignedIn();
  return useQuery({ queryKey: qk.referral, queryFn: api.me.referral, enabled: signedIn, staleTime: 60_000 });
}

/** Saisie du code d'un ami : montant tiré au sort, crédité aux deux comptes. */
export function useApplyReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.me.applyReferral({ code }),
    onSuccess: (r) => qc.setQueryData(qk.referral, r.referral),
  });
}

export function defaultAddress(list: AddressDto[] | undefined): AddressDto | null {
  if (!list?.length) return null;
  return list.find((a) => a.isDefault) ?? list[0] ?? null;
}
