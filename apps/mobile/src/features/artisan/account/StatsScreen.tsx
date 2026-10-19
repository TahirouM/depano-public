import { formatEuros, RULES } from '@depano/schemas';
import {
  Card,
  formatRating,
  Screen,
  SectionHeader,
  SkeletonList,
  StarRating,
  Text,
  useTheme,
} from '@depano/ui';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { BarChart } from '../components/BarChart';
import { useArtisanProfile, useStats } from '../queries';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)} %`);

/** Statistiques : CA par mois (6 derniers mois), taux d'acceptation, note moyenne, fiabilité. */
export function StatsScreen() {
  const t = useTheme();
  const q = useStats();
  const profile = useArtisanProfile();

  return (
    <Screen
      inTabs
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      testID="stats-screen"
    >
      <Stack.Screen options={{ title: 'Statistiques' }} />
      <QueryView query={q} loading={<SkeletonList count={3} />}>
        {(s) => <StatsBody s={s} reliability={profile.data?.reliabilityScore ?? null} t={t} />}
      </QueryView>
    </Screen>
  );
}

function StatsBody({
  s,
  reliability,
  t,
}: {
  s: NonNullable<ReturnType<typeof useStats>['data']>;
  reliability: number | null;
  t: ReturnType<typeof useTheme>;
}) {
  const bars = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = s.monthly.find((x) => x.month.startsWith(key));
      const label = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d).replace('.', '');
      return {
        key,
        label,
        value: m?.revenueCents ?? 0,
        display: formatEuros(m?.revenueCents ?? 0),
        count: m?.count ?? 0,
      };
    });
  }, [s.monthly]);
  const current = bars[bars.length - 1]!;
  const total6 = bars.reduce((a, b) => a + b.value, 0);

  return (
    <View style={{ gap: t.spacing.xl }}>
      <View style={{ gap: t.spacing.sm }}>
        <SectionHeader title="Chiffre d'affaires par mois" />
        <Card style={{ gap: t.spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <View>
              <Text variant="caption" tone="secondary">
                Ce mois-ci
              </Text>
              <Text variant="title1">{current.display}</Text>
            </View>
            <Text variant="callout" tone="secondary">
              6 mois : {formatEuros(total6)}
            </Text>
          </View>
          {total6 > 0 ? (
            <BarChart bars={bars} height={140} />
          ) : (
            <Text tone="secondary">Pas encore de chiffre d'affaires sur les 6 derniers mois.</Text>
          )}
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Card
          style={{ flex: 1, gap: 4 }}
          padding="md"
          accessibilityLabel={`Taux d'acceptation des urgences : ${pct(s.acceptanceRate)}`}
        >
          <Text variant="caption" tone="secondary">
            Taux d'acceptation
          </Text>
          <Text variant="title1">{pct(s.acceptanceRate)}</Text>
          <Text variant="caption" tone="secondary">
            des urgences reçues
          </Text>
        </Card>
        <Card
          style={{ flex: 1, gap: 4 }}
          padding="md"
          accessibilityLabel={`Note moyenne : ${formatRating(s.ratingAvg) ?? 'aucune'} sur 5, ${s.ratingCount} avis`}
        >
          <Text variant="caption" tone="secondary">
            Note moyenne
          </Text>
          <Text variant="title1">{formatRating(s.ratingAvg) ?? '—'}</Text>
          <StarRating value={s.ratingAvg} count={s.ratingCount} />
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Card style={{ flex: 1, gap: 4 }} padding="md">
          <Text variant="caption" tone="secondary">
            Interventions terminées
          </Text>
          <Text variant="title1">{s.completedCount}</Text>
        </Card>
        <Card style={{ flex: 1, gap: 4 }} padding="md">
          <Text variant="caption" tone="secondary">
            Annulations (30 j)
          </Text>
          <Text
            variant="title1"
            tone={
              s.cancellations30d >= RULES.artisanReliability.maxCancellationsIn30Days - 1
                ? 'danger'
                : 'primary'
            }
          >
            {s.cancellations30d} / {RULES.artisanReliability.maxCancellationsIn30Days}
          </Text>
        </Card>
      </View>
      {reliability != null ? (
        <Card variant="flat" style={{ gap: 4 }}>
          <Text variant="bodyStrong">Fiabilité : {reliability} / 100</Text>
          <Text variant="callout" tone="secondary">
            {RULES.artisanReliability.maxCancellationsIn30Days} annulations en 30 jours suspendent
            la réception des urgences.
          </Text>
        </Card>
      ) : null}
    </View>
  );
}
