import { DOMAIN_CODES, DOMAIN_LABELS } from '@depano/schemas';
import {
  ArtisanCard,
  Button,
  DOMAIN_ICONS,
  EmptyState,
  ErrorState,
  Icon,
  InterventionCard,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  useTheme,
} from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LocateFixed, MapPinOff, Search, Siren } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { interventionHref } from '@/components/PinnedInterventionHost';
import { errorMessage } from '@/lib/api';
import { useActiveBooking, useMe } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { useArtisanSearch } from '../queries';
import { useSearchOrigin } from '../useSearchOrigin';

/** Accueil client : urgence en 1 tap, recherche, métiers, artisans dispo près de moi. */
export function HomeScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const me = useMe();
  const active = useActiveBooking('client');
  const { origin, locate, locating } = useSearchOrigin();
  const nearby = useArtisanSearch({ lat: origin.lat, lng: origin.lng, availableToday: true, sort: 'distance', limit: 10, radiusKm: 20 });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([qc.invalidateQueries({ queryKey: qk.catalog.all }), qc.invalidateQueries({ queryKey: qk.bookings.lists })]);
    setRefreshing(false);
  };

  const hello = me.data?.firstName ? `Bonjour ${me.data.firstName}` : 'Bonjour';
  return (
    <Screen inTabs refreshing={refreshing} onRefresh={() => void refresh()} testID="home">
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.xs }}>
          <Text variant="title1">{hello}</Text>
          <Text tone="secondary">Un souci à la maison ? Un artisan vérifié, un prix connu d'avance.</Text>
        </View>

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
            minHeight: 96,
            padding: t.spacing.lg,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.tone.urgent.solid,
            opacity: pressed ? 0.9 : 1,
            ...t.elevation(3),
          })}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.tone.urgent.onSolid + '26', alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Siren} size={32} color={t.colors.tone.urgent.onSolid} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title2" color={t.colors.tone.urgent.onSolid}>
              Urgence
            </Text>
            <Text variant="callout" color={t.colors.tone.urgent.onSolid}>
              Un artisan chez vous au plus vite
            </Text>
          </View>
        </Pressable>

        <Pressable
          testID="home-search"
          onPress={() => router.push({ pathname: '/recherche', params: { focus: '1' } })}
          accessibilityRole="search"
          accessibilityLabel="Rechercher un artisan ou une prestation"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            minHeight: 52,
            paddingHorizontal: t.spacing.lg,
            borderRadius: t.radius.full,
            borderWidth: 1,
            borderColor: t.colors.border.input,
            backgroundColor: t.colors.background.surface,
          }}
        >
          <Icon icon={Search} color={t.colors.text.secondary} />
          <Text tone="secondary">Fuite, chaudière, prise…</Text>
        </Pressable>

        {active.data ? (
          <View style={{ gap: t.spacing.sm }}>
            <SectionHeader title="Intervention en cours" />
            <InterventionCard booking={active.data} onPress={() => router.push(interventionHref(active.data!, 'client'))} />
          </View>
        ) : null}

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Prendre rendez-vous" />
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
                    minHeight: 96,
                    padding: t.spacing.md,
                    borderRadius: t.radius.md,
                    backgroundColor: c.soft,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: t.spacing.sm,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Icon icon={DOMAIN_ICONS[d]} size={28} color={c.text} />
                  <Text variant="label" color={c.text} align="center" numberOfLines={1} adjustsFontSizeToFit>
                    {DOMAIN_LABELS[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Disponibles aujourd'hui" action={{ label: 'Tout voir', onPress: () => router.push({ pathname: '/recherche', params: { today: '1' } }) }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.sm }}>
            <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
              {origin.label}
              {origin.approximate ? ' (position approximative)' : ''}
            </Text>
            {origin.approximate || origin.label !== 'Près de vous' ? (
              <Button variant="ghost" size="sm" icon={LocateFixed} label="Ma position" loading={locating} onPress={() => void locate()} />
            ) : null}
          </View>
          {nearby.data ? (
            nearby.data.items.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.md, paddingVertical: t.spacing.xs }} style={{ marginHorizontal: -t.spacing.lg }}>
                <View style={{ width: t.spacing.xs }} />
                {nearby.data.items.map((a) => (
                  <ArtisanCard key={a.id} artisan={a} layout="compact" onPress={() => router.push({ pathname: '/artisan/[id]', params: { id: a.id } })} />
                ))}
                <View style={{ width: t.spacing.xs }} />
              </ScrollView>
            ) : (
              <EmptyState
                icon={MapPinOff}
                title="Aucun artisan dans la zone"
                message="Aucun artisan disponible aujourd'hui près de cette adresse. Essayez une autre date ou élargissez la recherche."
                action={{ label: 'Voir tous les artisans', onPress: () => router.push('/recherche') }}
              />
            )
          ) : nearby.isError ? (
            <ErrorState fill={false} message={errorMessage(nearby.error)} onRetry={() => void nearby.refetch()} />
          ) : (
            <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
              <Skeleton width={280} height={132} radius={t.radius.md} />
              <Skeleton width={80} height={132} radius={t.radius.md} />
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
