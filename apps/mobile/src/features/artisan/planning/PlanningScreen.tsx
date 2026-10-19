import {
  DOMAIN_CODES,
  DOMAIN_LABELS,
  type AvailabilityExceptionDto,
  type BookingSummaryDto,
  type PlanningDto,
} from '@depano/schemas';
import {
  Button,
  Card,
  ConfirmSheet,
  DOMAIN_ICONS,
  EmptyState,
  IconButton,
  InterventionCard,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  CalendarOff,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Siren,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import {
  addDays,
  addMonths,
  bookingWhen,
  dayLong,
  exceptionLabel,
  hhmm,
  localDayKey,
  monthGrid,
  monthLabel,
  startOfDay,
  startOfMonth,
} from '../dates';
import { usePlanning } from '../queries';
import { WEEKDAY_LABELS } from '../components/WeekRulesEditor';

const WEEK_HEAD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEK_HEAD_A11Y = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const CANCELLED = ['cancelled_by_client', 'cancelled_by_artisan', 'expired'];

function overlapsDay(e: AvailabilityExceptionDto, day: Date) {
  const s = startOfDay(day).getTime();
  const end = addDays(startOfDay(day), 1).getTime();
  return new Date(e.startsAt).getTime() < end && new Date(e.endsAt).getTime() > s;
}

/** Planning : vue mois (pastilles par métier) + vue jour, légende, indisponibilités perso. */
export function PlanningScreen() {
  const t = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<'month' | 'day'>('month');
  const grid = useMemo(() => monthGrid(month), [month]);
  const from = grid[0]!.toISOString();
  const to = addDays(grid[41]!, 1).toISOString();
  const q = usePlanning(from, to);

  const goMonth = (n: number) => {
    const m = addMonths(month, n);
    setMonth(m);
    setSelected(m);
  };
  const goDay = (n: number) => {
    const d = addDays(selected, n);
    setSelected(d);
    if (d.getMonth() !== month.getMonth()) setMonth(startOfMonth(d));
  };

  return (
    <Screen
      inTabs
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        <Button
          label="Ajouter une indisponibilité"
          icon={CalendarPlus}
          size="lg"
          variant="secondary"
          fullWidth
          onPress={() =>
            router.push({
              pathname: '/pro/planning/indisponibilite',
              params: { date: localDayKey(selected) },
            })
          }
          testID="add-unavailability"
        />
      }
      testID="pro-planning"
    >
      <View style={{ gap: t.spacing.lg }}>
        <SegmentedControl
          options={[
            { value: 'month', label: 'Mois' },
            { value: 'day', label: 'Jour' },
          ]}
          value={view}
          onChange={setView}
          accessibilityLabel="Vue du planning"
        />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel={view === 'month' ? 'Mois précédent' : 'Jour précédent'}
            onPress={() => (view === 'month' ? goMonth(-1) : goDay(-1))}
          />
          <Text variant="title2" accessibilityRole="header" align="center" style={{ flex: 1 }}>
            {view === 'month' ? monthLabel(month) : dayLong(selected)}
          </Text>
          <IconButton
            icon={ChevronRight}
            accessibilityLabel={view === 'month' ? 'Mois suivant' : 'Jour suivant'}
            onPress={() => (view === 'month' ? goMonth(1) : goDay(1))}
          />
        </View>

        <QueryView query={q} loading={<SkeletonCard />}>
          {(p) => (
            <View style={{ gap: t.spacing.lg }}>
              {view === 'month' ? (
                <MonthGrid
                  grid={grid}
                  month={month}
                  planning={p}
                  selected={selected}
                  onSelect={(d) => {
                    setSelected(d);
                    if (d.getMonth() !== month.getMonth()) setMonth(startOfMonth(d));
                  }}
                />
              ) : null}
              <Legend />
              <DayAgenda day={selected} planning={p} showTitle={view === 'month'} />
            </View>
          )}
        </QueryView>
      </View>
    </Screen>
  );
}

function MonthGrid({
  grid,
  month,
  planning,
  selected,
  onSelect,
}: {
  grid: Date[];
  month: Date;
  planning: PlanningDto;
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const t = useTheme();
  const byDay = useMemo(() => {
    const m = new Map<string, BookingSummaryDto[]>();
    for (const b of planning.bookings) {
      if (CANCELLED.includes(b.status)) continue;
      const k = localDayKey(bookingWhen(b));
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return m;
  }, [planning.bookings]);
  const today = localDayKey(new Date());
  const sel = localDayKey(selected);
  const workDays = new Set(planning.rules.map((r) => r.weekday));

  return (
    <View>
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        {WEEK_HEAD.map((h, i) => (
          <Text
            key={i}
            variant="caption"
            tone="secondary"
            align="center"
            style={{ flex: 1 }}
            accessibilityLabel={WEEK_HEAD_A11Y[i]}
          >
            {h}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={{ flexDirection: 'row' }}>
          {grid.slice(w * 7, w * 7 + 7).map((d) => {
            const k = localDayKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const items = byDay.get(k) ?? [];
            const off = planning.exceptions.some((e) => overlapsDay(e, d));
            const closed = !workDays.has(d.getDay());
            const isSel = k === sel;
            const label = `${dayLong(d)}${k === today ? ", aujourd'hui" : ''} : ${items.length ? `${items.length} intervention${items.length > 1 ? 's' : ''}` : 'aucune intervention'}${off ? ', indisponible' : closed ? ', fermé' : ''}`;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={label}
                onPress={() => onSelect(d)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  margin: 1,
                  borderRadius: t.radius.sm,
                  alignItems: 'center',
                  paddingTop: 4,
                  gap: 3,
                  backgroundColor: isSel
                    ? t.colors.brand.primary
                    : off
                      ? t.colors.background.subtle
                      : 'transparent',
                  borderWidth: k === today && !isSel ? 2 : 0,
                  borderColor: t.colors.brand.primary,
                  opacity: inMonth ? 1 : 0.4,
                }}
                testID={`day-cell-${k}`}
              >
                <Text
                  variant="label"
                  color={
                    isSel
                      ? t.colors.brand.onPrimary
                      : closed && !items.length
                        ? t.colors.text.secondary
                        : t.colors.text.primary
                  }
                  style={off && !isSel ? { textDecorationLine: 'line-through' } : undefined}
                  maxFontSizeMultiplier={1.3}
                >
                  {d.getDate()}
                </Text>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {items.slice(0, 3).map((b) => (
                    <View
                      key={b.id}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: b.kind === 'urgent' ? 1 : 4,
                        backgroundColor: isSel
                          ? t.colors.brand.onPrimary
                          : t.colors.domain[b.domain].solid,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Legend() {
  const t = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}
      accessibilityLabel="Légende : couleur par métier, carré pour une urgence, rond pour un rendez-vous, jour barré pour une indisponibilité"
    >
      {DOMAIN_CODES.map((d) => (
        <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: t.colors.domain[d].solid,
            }}
          />
          <Text variant="caption" tone="secondary">
            {DOMAIN_LABELS[d]}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 1,
            backgroundColor: t.colors.text.secondary,
          }}
        />
        <Text variant="caption" tone="secondary">
          Urgence (carré)
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View
          style={{
            width: 14,
            height: 10,
            borderRadius: 2,
            backgroundColor: t.colors.background.subtle,
            borderWidth: 1,
            borderColor: t.colors.border.subtle,
          }}
        />
        <Text variant="caption" tone="secondary">
          Indisponible
        </Text>
      </View>
    </View>
  );
}

function DayAgenda({
  day,
  planning,
  showTitle,
}: {
  day: Date;
  planning: PlanningDto;
  showTitle: boolean;
}) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<AvailabilityExceptionDto | null>(null);
  const k = localDayKey(day);
  const bookings = planning.bookings
    .filter((b) => localDayKey(bookingWhen(b)) === k)
    .sort((a, b) => bookingWhen(a).localeCompare(bookingWhen(b)));
  const exceptions = planning.exceptions.filter((e) => overlapsDay(e, day));
  const rules = planning.rules
    .filter((r) => r.weekday === day.getDay())
    .sort((a, b) => a.start.localeCompare(b.start));

  const del = useMutation({
    mutationFn: (id: string) => api.artisan.deleteException(id),
    onSuccess: () => {
      setToDelete(null);
      toast.success('Indisponibilité supprimée.');
      void qc.invalidateQueries({ queryKey: ['artisan', 'planning'] });
      void qc.invalidateQueries({ queryKey: qk.artisan.exceptions });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <View style={{ gap: t.spacing.md }} testID="day-agenda">
      {showTitle ? (
        <Text variant="bodyStrong" accessibilityRole="header">
          {dayLong(day)}
        </Text>
      ) : null}
      <Card
        variant="flat"
        style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}
      >
        <Clock size={20} color={t.colors.text.secondary} />
        <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
          {rules.length
            ? `${WEEKDAY_LABELS[day.getDay()]} : ${rules.map((r) => `${r.start}–${r.end}`).join(' · ')}`
            : `${WEEKDAY_LABELS[day.getDay()]} : fermé (horaires types)`}
        </Text>
      </Card>
      {exceptions.map((e) => (
        <Card
          key={e.id}
          variant="outline"
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
          testID="exception-card"
        >
          <CalendarOff size={20} color={t.colors.tone.warning.text} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{e.reason || 'Indisponible'}</Text>
            <Text variant="callout" tone="secondary">
              {exceptionLabel(e)}
            </Text>
          </View>
          <IconButton
            icon={Trash2}
            accessibilityLabel={`Supprimer l'indisponibilité ${e.reason ?? ''}`}
            onPress={() => setToDelete(e)}
          />
        </Card>
      ))}
      {bookings.length ? (
        bookings.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <View style={{ width: 48, paddingTop: t.spacing.lg, alignItems: 'center', gap: 4 }}>
              <Text variant="label">{hhmm(bookingWhen(b))}</Text>
              {b.kind === 'urgent' ? (
                <Siren size={16} color={t.colors.tone.urgent.text} />
              ) : (
                (() => {
                  const I = DOMAIN_ICONS[b.domain];
                  return <I size={16} color={t.colors.domain[b.domain].text} />;
                })()
              )}
            </View>
            <View style={{ flex: 1 }}>
              <InterventionCard
                booking={b}
                perspective="artisan"
                onPress={() =>
                  router.push({ pathname: '/pro/interventions/[id]', params: { id: b.id } })
                }
              />
            </View>
          </View>
        ))
      ) : !exceptions.length ? (
        <EmptyState
          icon={CalendarOff}
          title="Rien de prévu ce jour-là"
          message={
            rules.length
              ? 'Vos créneaux sont ouverts à la réservation.'
              : 'Journée fermée dans vos horaires types.'
          }
        />
      ) : null}
      <ConfirmSheet
        visible={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        loading={del.isPending}
        title="Supprimer cette indisponibilité ?"
        message="Vos créneaux redeviendront réservables par les clients."
        confirmLabel="Supprimer"
        tone="danger"
      />
    </View>
  );
}
