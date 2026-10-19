import { DOMAIN_CODES, DomainCode, formatEuros, type ArtisanCardDto, type ArtisanSearchQuery } from '@depano/schemas';
import {
  ArtisanCard,
  BottomSheet,
  Button,
  Chip,
  DomainChip,
  EmptyState,
  IconButton,
  SegmentedControl,
  SkeletonList,
  Switch,
  Text,
  TextField,
  useTheme,
} from '@depano/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { useIsSignedIn } from '@/lib/query/hooks';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { LiveMap } from '../map/LiveMap';
import type { MapMarker } from '../map/types';
import { useArtisanSearchInfinite, useDebounced, useFavorites, useToggleFavorite } from '../queries';
import { useSearchOrigin } from '../useSearchOrigin';

type Filters = Pick<ArtisanSearchQuery, 'domain' | 'availableToday' | 'minRating' | 'maxPriceCents' | 'sort'>;
const SORTS: { value: ArtisanSearchQuery['sort']; label: string }[] = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'distance', label: 'Distance' },
  { value: 'rating', label: 'Note' },
  { value: 'price', label: 'Prix' },
];
const RATINGS = [4.5, 4, 3.5];
const PRICES = [6000, 8000, 10000, 15000];

/** Recherche / résultats : texte, filtres en bottom sheet, liste ou carte, favoris. */
export function SearchScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ domain?: string; today?: string; focus?: string; q?: string }>();
  const parsedDomain = DomainCode.safeParse(params.domain);
  const [text, setText] = useState(params.q ?? '');
  const [filters, setFilters] = useState<Filters>({
    domain: parsedDomain.success ? parsedDomain.data : undefined,
    availableToday: params.today === '1' ? true : undefined,
    sort: 'relevance',
  });
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const { origin } = useSearchOrigin();
  const q = useDebounced(text.trim(), 350);
  const query = useMemo<Partial<ArtisanSearchQuery>>(
    () => ({ ...filters, q: q || undefined, lat: origin.lat, lng: origin.lng, radiusKm: 20, limit: 20 }),
    [filters, q, origin.lat, origin.lng],
  );
  const results = useArtisanSearchInfinite(query);
  const signedIn = useIsSignedIn();
  const favorites = useFavorites();
  const toggleFav = useToggleFavorite();
  const requireAuth = useRequireAuth();
  const favIds = new Set((favorites.data ?? []).map((a) => a.id));

  const activeCount = [filters.domain, filters.availableToday, filters.minRating, filters.maxPriceCents, filters.sort !== 'relevance' ? 1 : undefined].filter(Boolean).length;
  const reset = () => {
    const empty: Filters = { sort: 'relevance' };
    setFilters(empty);
    setDraftFilters(empty);
    setText('');
  };
  const onFav = (a: ArtisanCardDto) => {
    if (!requireAuth('Connectez-vous pour enregistrer vos artisans favoris.')) return;
    toggleFav.mutate({ artisan: a, favorite: !favIds.has(a.id) });
  };

  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const markers = useMemo<MapMarker[]>(
    () =>
      items
        .filter((a) => a.approxLat != null && a.approxLng != null)
        .map((a) => ({
          id: a.id,
          lat: a.approxLat!,
          lng: a.approxLng!,
          title: a.displayName,
          description: [
            a.ratingAvg != null ? `${String(a.ratingAvg).replace('.', ',')} ★ (${a.ratingCount})` : null,
            a.fromPriceCents != null ? `dès ${formatEuros(a.fromPriceCents)}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          onPress: () => router.push({ pathname: '/artisan/[id]', params: { id: a.id } }),
        })),
    [results.data], // eslint-disable-line react-hooks/exhaustive-deps -- `items` dérive de results.data
  );
  const sorted = view === 'map' ? [...items].sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99)) : items;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background.canvas }} testID="search">
      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Rechercher"
              value={text}
              onChangeText={setText}
              placeholder="Artisan, prestation…"
              autoFocus={params.focus === '1'}
              returnKeyType="search"
              testID="search-input"
              right={text ? <IconButton icon={X} accessibilityLabel="Effacer la recherche" onPress={() => setText('')} /> : undefined}
            />
          </View>
          <IconButton
            icon={SlidersHorizontal}
            variant="filled"
            badge={activeCount || undefined}
            accessibilityLabel={activeCount ? `Filtres, ${activeCount} actif${activeCount > 1 ? 's' : ''}` : 'Filtres'}
            onPress={() => {
              setDraftFilters(filters);
              setSheet(true);
            }}
            testID="open-filters"
          />
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
          {DOMAIN_CODES.map((d) => (
            <DomainChip key={d} domain={d} size="sm" selected={filters.domain === d} onPress={() => setFilters((f) => ({ ...f, domain: f.domain === d ? undefined : d }))} />
          ))}
          <Chip size="sm" label="Dispo aujourd'hui" selected={!!filters.availableToday} onPress={() => setFilters((f) => ({ ...f, availableToday: f.availableToday ? undefined : true }))} />
        </View>
        <SegmentedControl
          accessibilityLabel="Affichage des résultats"
          options={[
            { value: 'list', label: 'Liste' },
            { value: 'map', label: 'Carte' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      <QueryView
        query={results}
        loading={
          <View style={{ padding: t.spacing.lg }}>
            <SkeletonList count={4} />
          </View>
        }
        isEmpty={(d) => d.pages.every((p) => p.items.length === 0)}
        empty={{
          icon: SearchX,
          title: 'Aucun résultat',
          message: 'Aucun artisan ne correspond à ces critères près de chez vous. Élargissez les filtres.',
          action: { label: 'Réinitialiser les filtres', onPress: reset },
        }}
      >
        {() => (
          <FlatList
            data={sorted}
            keyExtractor={(a) => a.id}
            // Tabs natives iOS : la tab bar flotte au-dessus de la liste ; UIKit ajoute l'inset bas.
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xxxl }}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
            }}
            refreshing={results.isRefetching && !results.isFetchingNextPage}
            onRefresh={() => void results.refetch()}
            ListHeaderComponent={
              view === 'map' ? (
                <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
                  <LiveMap
                    center={origin}
                    radiusKm={20}
                    height={240}
                    markers={markers}
                    accessibilityLabel={`Carte de la zone de recherche, ${markers.length} artisans dans un rayon de 20 km`}
                  />
                  <Text variant="callout" tone="secondary">
                    Classés du plus proche au plus éloigné · {origin.label}
                  </Text>
                </View>
              ) : (
                <Text variant="callout" tone="secondary" style={{ marginBottom: t.spacing.xs }}>
                  {items.length} artisan{items.length > 1 ? 's' : ''} · {origin.label}
                </Text>
              )
            }
            ListFooterComponent={results.isFetchingNextPage ? <SkeletonList count={1} /> : undefined}
            renderItem={({ item }) => (
              <ArtisanCard
                artisan={item}
                onPress={() => router.push({ pathname: '/artisan/[id]', params: { id: item.id } })}
                favorite={signedIn ? favIds.has(item.id) : false}
                onToggleFavorite={() => onFav(item)}
              />
            )}
          />
        )}
      </QueryView>

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Filtres"
        testID="filters-sheet"
        footer={
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button variant="ghost" label="Effacer" onPress={() => setDraftFilters({ sort: 'relevance' })} style={{ flex: 1 }} />
            <Button
              label="Afficher les résultats"
              onPress={() => {
                setFilters(draftFilters);
                setSheet(false);
              }}
              style={{ flex: 2 }}
              testID="apply-filters"
            />
          </View>
        }
      >
        <View style={{ gap: t.spacing.xl }}>
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Métier</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {DOMAIN_CODES.map((d) => (
                <DomainChip key={d} domain={d} selected={draftFilters.domain === d} onPress={() => setDraftFilters((f) => ({ ...f, domain: f.domain === d ? undefined : d }))} />
              ))}
            </View>
          </View>
          <Switch
            label="Disponible aujourd'hui"
            value={!!draftFilters.availableToday}
            onValueChange={(v) => setDraftFilters((f) => ({ ...f, availableToday: v || undefined }))}
          />
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Note minimale</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {RATINGS.map((r) => (
                <Chip
                  key={r}
                  label={`${String(r).replace('.', ',')} ★ et plus`}
                  accessibilityLabel={`${String(r).replace('.', ',')} étoiles et plus`}
                  selected={draftFilters.minRating === r}
                  onPress={() => setDraftFilters((f) => ({ ...f, minRating: f.minRating === r ? undefined : r }))}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Prix de départ maximum</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {PRICES.map((p) => (
                <Chip
                  key={p}
                  label={`≤ ${formatEuros(p)}`}
                  selected={draftFilters.maxPriceCents === p}
                  onPress={() => setDraftFilters((f) => ({ ...f, maxPriceCents: f.maxPriceCents === p ? undefined : p }))}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Trier par</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {SORTS.map((s) => (
                <Chip key={s.value} label={s.label} selected={draftFilters.sort === s.value} onPress={() => setDraftFilters((f) => ({ ...f, sort: s.value }))} />
              ))}
            </View>
          </View>
          <Text variant="caption" tone="secondary">
            Classement « Pertinence » : distance, note, taux d'acceptation et disponibilité. Détails dans Profil › Aide › Comment sont classés les artisans.
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}
