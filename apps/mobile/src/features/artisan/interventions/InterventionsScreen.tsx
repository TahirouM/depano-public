import type { BookingStatus, BookingSummaryDto } from '@depano/schemas';
import {
  EmptyState,
  IconButton,
  InterventionCard,
  Screen,
  SectionHeader,
  SkeletonList,
  Text,
  useTheme,
} from '@depano/ui';
import { router } from 'expo-router';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { addDays, bookingWhen, localDayKey, startOfWeek, weekdayShort, weekLabel } from '../dates';
import { useArtisanBookings } from '../queries';

export const STATUS_GROUPS: { key: string; title: string; statuses: BookingStatus[] }[] = [
  {
    key: 'now',
    title: 'En cours',
    statuses: ['en_route', 'arrived', 'quote_pending', 'in_progress', 'awaiting_code'],
  },
  { key: 'next', title: 'À venir', statuses: ['accepted', 'searching', 'pending_payment'] },
  { key: 'done', title: 'Terminées', statuses: ['closed'] },
  {
    key: 'other',
    title: 'Annulées et litiges',
    statuses: ['cancelled_by_client', 'cancelled_by_artisan', 'expired', 'disputed'],
  },
];

/** Interventions : liste du jour groupée par statut, navigation par semaine. */
export function InterventionsScreen() {
  const t = useTheme();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();
  const q = useArtisanBookings({ from, to, scope: 'all' });

  const byDay = useMemo(() => {
    const m = new Map<string, BookingSummaryDto[]>();
    for (const b of q.data?.items ?? []) {
      const k = localDayKey(bookingWhen(b));
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [q.data]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const moveWeek = (n: number) => {
    const ws = addDays(weekStart, 7 * n);
    setWeekStart(ws);
    const today = localDayKey(new Date());
    const inWeek = Array.from({ length: 7 }, (_, i) => localDayKey(addDays(ws, i))).includes(today);
    setDay(inWeek ? today : localDayKey(ws));
  };
  const items = (byDay.get(day) ?? []).sort((a, b) => bookingWhen(a).localeCompare(bookingWhen(b)));

  return (
    <Screen
      inTabs
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      testID="pro-interventions"
    >
      <View style={{ gap: t.spacing.lg }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Semaine précédente"
            onPress={() => moveWeek(-1)}
            testID="week-prev"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Revenir à la semaine en cours"
            onPress={() =>
              moveWeek(
                0 -
                  Math.round(
                    (weekStart.getTime() - startOfWeek(new Date()).getTime()) / (7 * 86_400_000),
                  ),
              )
            }
          >
            <Text variant="bodyStrong" align="center">
              {weekLabel(weekStart)}
            </Text>
          </Pressable>
          <IconButton
            icon={ChevronRight}
            accessibilityLabel="Semaine suivante"
            onPress={() => moveWeek(1)}
            testID="week-next"
          />
        </View>

        <View style={{ flexDirection: 'row', gap: t.spacing.xs }} accessibilityRole="tablist">
          {days.map((d) => {
            const k = localDayKey(d);
            const sel = k === day;
            const n = byDay.get(k)?.length ?? 0;
            const today = k === localDayKey(new Date());
            return (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel }}
                accessibilityLabel={`${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}${today ? ", aujourd'hui" : ''}, ${n} intervention${n > 1 ? 's' : ''}`}
                onPress={() => setDay(k)}
                style={{
                  flex: 1,
                  minHeight: 64,
                  borderRadius: t.radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  backgroundColor: sel ? t.colors.brand.primary : t.colors.background.surface,
                  borderWidth: today && !sel ? 2 : 0,
                  borderColor: t.colors.brand.primary,
                }}
              >
                <Text
                  variant="caption"
                  color={sel ? t.colors.brand.onPrimary : t.colors.text.secondary}
                  maxFontSizeMultiplier={1.3}
                >
                  {weekdayShort(d)}
                </Text>
                <Text
                  variant="bodyStrong"
                  color={sel ? t.colors.brand.onPrimary : t.colors.text.primary}
                  maxFontSizeMultiplier={1.3}
                >
                  {d.getDate()}
                </Text>
                <View style={{ height: 6, flexDirection: 'row', gap: 2 }}>
                  {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: sel ? t.colors.brand.onPrimary : t.colors.brand.primary,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <QueryView query={q} loading={<SkeletonList count={3} />}>
          {() =>
            items.length === 0 ? (
              <EmptyState
                icon={CalendarX2}
                title="Aucune intervention ce jour-là"
                message="Activez « Disponible pour urgences » sur l'accueil ou publiez vos disponibilités pour recevoir des rendez-vous."
                action={{ label: "Aller à l'accueil", onPress: () => router.push('/pro/accueil') }}
                secondaryAction={{
                  label: 'Voir le planning',
                  onPress: () => router.push('/pro/planning'),
                }}
              />
            ) : (
              <View style={{ gap: t.spacing.xl }}>
                {STATUS_GROUPS.map((g) => {
                  const list = items.filter((b) => g.statuses.includes(b.status));
                  if (!list.length) return null;
                  return (
                    <View key={g.key} style={{ gap: t.spacing.sm }}>
                      <SectionHeader title={`${g.title} (${list.length})`} />
                      {list.map((b) => (
                        <InterventionCard
                          key={b.id}
                          booking={b}
                          perspective="artisan"
                          onPress={() =>
                            router.push({
                              pathname: '/pro/interventions/[id]',
                              params: { id: b.id },
                            })
                          }
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            )
          }
        </QueryView>
      </View>
    </Screen>
  );
}
