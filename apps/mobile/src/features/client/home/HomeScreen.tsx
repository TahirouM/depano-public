import { DOMAIN_CODES, DOMAIN_LABELS } from '@depano/schemas';
import {
  Button,
  Card,
  DOMAIN_ICONS,
  EmptyState,
  ErrorState,
  Icon,
  InterventionCard,
  SectionHeader,
  Skeleton,
  Text,
  useTheme,
} from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, LocateFixed, MapPinOff, Search, ShieldCheck, Siren, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { HeaderBell } from '@/components/HeaderBell';
import { interventionHref } from '@/components/PinnedInterventionHost';
import { errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { useActiveBooking } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { useAppStore } from '@/stores/app';
import { ArtisanResultCard } from '../components/ArtisanResultCard';
import { HeroSheetLayout } from '../components/HeroSheetLayout';
import { useArtisanSearch } from '../queries';
import { DEFAULT_CITY, useSearchOrigin } from '../useSearchOrigin';
import { resultsLabel, shouldSuggestLocation } from './homeCopy';
import { LocationPicker } from './LocationPicker';

/**
 * Accueil client, accessible sans compte : en-tête fixe (lieu, cloche, accroche) et feuille de contenu
 * qui le recouvre au défilement (recherche, urgence si activée, domaines, artisans près du lieu choisi).
 */
export function HomeScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const active = useActiveBooking('client');
  const { origin, locate, locating, setPlace } = useSearchOrigin();
  const locationAsked = useAppStore((s) => s.permissionAsked.location);
  const results = useArtisanSearch({ lat: origin.lat, lng: origin.lng, sort: 'relevance', limit: 10, radiusKm: 20 });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([qc.invalidateQueries({ queryKey: qk.catalog.all }), qc.invalidateQueries({ queryKey: qk.bookings.lists })]);
    setRefreshing(false);
  };

  return (
    <HeroSheetLayout
      testID="home"
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      topBar={
        <>
          <LocationPicker origin={origin} locating={locating} locate={locate} setPlace={setPlace} />
          <HeaderBell />
        </>
      }
      hero={
        <View style={{ gap: t.spacing.sm, maxWidth: 360 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: t.spacing.xs,
              paddingHorizontal: t.spacing.sm,
              paddingVertical: 4,
              borderRadius: t.radius.full,
              backgroundColor: t.colors.background.surface,
              ...t.elevation(1),
            }}
          >
            <Icon icon={ShieldCheck} size={16} color={t.colors.tone.success.text} />
            <Text variant="caption" weight="semibold">
              Artisans vérifiés
            </Text>
          </View>
          <Text variant="display" accessibilityRole="header">
            Dépannage{'\n'}à portée de main
          </Text>
          <Text tone="secondary" style={{ maxWidth: 280 }}>
            Trouvez rapidement un artisan qualifié près de chez vous.
          </Text>
        </View>
      }
    >
      <Pressable
        testID="home-search"
        onPress={() => router.push({ pathname: '/recherche', params: { focus: '1' } })}
        accessibilityRole="search"
        accessibilityLabel="Chercher un artisan ou une intervention"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          minHeight: 56,
          marginTop: -t.spacing.sm,
          paddingHorizontal: t.spacing.lg,
          borderRadius: t.radius.full,
          borderWidth: 1,
          borderColor: t.colors.border.subtle,
          backgroundColor: t.colors.background.surface,
          ...t.elevation(1),
        }}
      >
        <Icon icon={Search} color={t.colors.text.secondary} />
        <Text tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
          Chercher un artisan, une intervention…
        </Text>
        <Icon icon={SlidersHorizontal} color={t.colors.text.secondary} />
      </Pressable>

      {shouldSuggestLocation(origin, locationAsked) ? (
        <Card variant="outline" style={{ gap: t.spacing.md }} testID="home-locate-prompt">
          <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <Icon icon={LocateFixed} color={t.colors.text.brand} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Voir les artisans les plus proches de vous
            </Text>
          </View>
          <Text variant="callout" tone="secondary">
            Partagez votre position, ou restez sur {DEFAULT_CITY.label}. Vous pourrez changer à tout moment en haut de l'écran.
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button label="Utiliser ma position" size="sm" loading={locating} onPress={() => void locate()} style={{ flex: 1 }} />
            <Button label={`Rester sur ${DEFAULT_CITY.label}`} size="sm" variant="ghost" onPress={() => setPlace({ ...DEFAULT_CITY })} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      {/* Urgences masquées tant que le drapeau est désactivé (features.urgent). */}
      {features.urgent ? (
        <Pressable
          testID="home-urgent"
          onPress={() => router.push('/urgence/domaine')}
          accessibilityRole="button"
          accessibilityLabel="Urgence : trouver un artisan maintenant"
          accessibilityHint="Plomberie, électricité ou chauffage, en moins de 90 secondes"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.lg,
            minHeight: 80,
            padding: t.spacing.lg,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.tone.urgent.solid,
            opacity: pressed ? 0.9 : 1,
            ...t.elevation(1),
          })}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.tone.urgent.onSolid + '26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Siren} size={28} color={t.colors.tone.urgent.onSolid} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title2" color={t.colors.tone.urgent.onSolid}>
              Urgence
            </Text>
            <Text variant="callout" color={t.colors.tone.urgent.onSolid}>
              Un artisan chez vous au plus vite
            </Text>
          </View>
          <Icon icon={ChevronRight} color={t.colors.tone.urgent.onSolid} />
        </Pressable>
      ) : null}

      {active.data ? (
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Intervention en cours" />
          <InterventionCard booking={active.data} onPress={() => router.push(interventionHref(active.data!, 'client'))} />
        </View>
      ) : null}

      <View style={{ gap: t.spacing.md }}>
        <SectionHeader title="Domaines" action={{ label: 'Voir tout', onPress: () => router.push('/recherche') }} />
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {DOMAIN_CODES.map((d) => {
            const c = t.colors.domain[d];
            return (
              <Pressable
                key={d}
                testID={`home-domain-${d}`}
                onPress={() => router.push({ pathname: '/recherche', params: { domain: d } })}
                accessibilityRole="button"
                accessibilityLabel={`Artisans en ${DOMAIN_LABELS[d]}`}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 112,
                  padding: t.spacing.md,
                  borderRadius: t.radius.md,
                  backgroundColor: c.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: t.spacing.sm,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.background.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon={DOMAIN_ICONS[d]} size={26} color={c.text} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text variant="label" color={c.text} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
                    {DOMAIN_LABELS[d]}
                  </Text>
                  <Icon icon={ChevronRight} size={14} color={c.text} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="title2" accessibilityRole="header">
              {results.data ? resultsLabel(results.data.items.length, !!results.data.nextCursor) : 'Résultats'}
            </Text>
            <Text variant="callout" tone="secondary" numberOfLines={1}>
              {origin.label}
              {origin.approximate ? ' (position approximative)' : ''}
            </Text>
          </View>
          <Button variant="secondary" size="sm" icon={SlidersHorizontal} label="Filtrer" onPress={() => router.push('/recherche')} testID="home-filter" />
        </View>
        {results.data ? (
          results.data.items.length ? (
            <View style={{ gap: t.spacing.md }}>
              {results.data.items.map((a) => (
                <ArtisanResultCard key={a.id} artisan={a} onPress={() => router.push({ pathname: '/artisan/[id]', params: { id: a.id } })} />
              ))}
              {results.data.nextCursor ? <Button variant="ghost" label="Voir tous les artisans" onPress={() => router.push('/recherche')} /> : null}
            </View>
          ) : (
            <EmptyState
              icon={MapPinOff}
              title="Aucun artisan dans la zone"
              message="Aucun artisan disponible près de ce lieu. Changez de lieu en haut de l'écran ou élargissez la recherche."
              action={{ label: 'Voir tous les artisans', onPress: () => router.push('/recherche') }}
            />
          )
        ) : results.isError ? (
          <ErrorState fill={false} message={errorMessage(results.error)} onRetry={() => void results.refetch()} />
        ) : (
          <View style={{ gap: t.spacing.md }}>
            <Skeleton height={132} radius={t.radius.md} />
            <Skeleton height={132} radius={t.radius.md} />
          </View>
        )}
      </View>
    </HeroSheetLayout>
  );
}
