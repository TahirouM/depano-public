import {
  DOMAIN_CODES,
  DOMAIN_LABELS,
  type AvailabilityExceptionDto,
  type BookingSummaryDto,
  type PlanningDto,
} from '@depano/schemas';
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  IconButton,
  ListItem,
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
  Clock,
  Info,
  Pencil,
  Siren,
  StickyNote,
  Trash2,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { HeaderBell } from '@/components/HeaderBell';
import { QueryView } from '@/components/QueryView';
import { HeroSheetLayout } from '@/features/client/components/HeroSheetLayout';
import { api, errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { qk } from '@/lib/query/keys';
import {
  addDays,
  dayLong,
  exceptionLabel,
  localDayKey,
  monthGrid,
  startOfDay,
  startOfMonth,
} from '../dates';
import { PLANNING_PREFIX, usePlanning } from '../queries';
import { WEEKDAY_LABELS } from '../components/WeekRulesEditor';
import {
  dayDots,
  dayItems,
  shortTime,
  timelineRows,
  type DayDot,
  type PlanningItem,
} from './calendar';
import { EVENT_COLOR_LABELS, eventColor } from './eventColors';
import { Dot, MonthCalendar } from './MonthCalendar';

/** Libellé court d'une intervention (maquette : « Mr Dupont - Dépannage - Fuite d'eau »). */
function bookingTitle(b: BookingSummaryDto) {
  return [b.counterpart?.name, DOMAIN_LABELS[b.domain], b.serviceName ?? b.problemReason]
    .filter(Boolean)
    .join(' - ');
}

/**
 * « Mon planning » : calendrier du mois (pastilles par métier / couleur d'événement) et frise du jour
 * (interventions, demandes à traiter, événements personnels, indisponibilités). Même habillage que les
 * onglets client ; les actions du jour (événement, indisponibilité) sont sous le calendrier.
 */
export function PlanningScreen() {
  const t = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [legend, setLegend] = useState(false);
  const grid = useMemo(() => monthGrid(month), [month]);
  const from = grid[0]!.toISOString();
  const to = addDays(grid[41]!, 1).toISOString();
  const q = usePlanning(from, to);

  const byDay = useMemo(() => {
    const m = new Map<string, PlanningItem[]>();
    if (!q.data) return m;
    for (const d of grid) m.set(localDayKey(d), dayItems(q.data, d));
    return m;
  }, [q.data, grid]);

  return (
    <HeroSheetLayout
      testID="pro-planning"
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      topBar={
        <>
          <View />
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon={Info}
              accessibilityLabel="Légende du planning"
              onPress={() => setLegend(true)}
              testID="planning-legend"
            />
            <HeaderBell />
          </View>
        </>
      }
      hero={
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="display" accessibilityRole="header">
            Mon planning
          </Text>
          <Text tone="secondary">Rendez-vous, événements personnels et indisponibilités.</Text>
        </View>
      }
    >
      <View style={{ gap: t.spacing.xl }}>
        <MonthCalendar
          month={month}
          onMonthChange={(m) => {
            setMonth(m);
            setSelected(m);
          }}
          selected={selected}
          onSelect={(d) => setSelected(d)}
          dotsFor={(d) => dayDots(byDay.get(localDayKey(d)) ?? [])}
          describe={(d) => describeDay(byDay.get(localDayKey(d)) ?? [])}
          testID="planning-calendar"
        />
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Button
            label="Ajouter un événement"
            icon={CalendarPlus}
            style={{ flex: 1 }}
            onPress={() =>
              router.push({
                pathname: '/pro/planning/evenement',
                params: { date: localDayKey(selected) },
              })
            }
            testID="add-event"
          />
          <Button
            label="Indisponibilité"
            icon={CalendarOff}
            variant="secondary"
            accessibilityLabel="Ajouter une indisponibilité"
            onPress={() =>
              router.push({
                pathname: '/pro/planning/indisponibilite',
                params: { date: localDayKey(selected) },
              })
            }
            testID="add-unavailability"
          />
        </View>
        <QueryView query={q} loading={<SkeletonCard />}>
          {(p) => (
            <DayAgenda day={selected} planning={p} items={byDay.get(localDayKey(selected)) ?? []} />
          )}
        </QueryView>
      </View>
      <LegendSheet visible={legend} onClose={() => setLegend(false)} />
    </HeroSheetLayout>
  );
}

function describeDay(items: PlanningItem[]): string {
  const n = items.filter((i) => i.type === 'booking').length;
  const req = items.filter((i) => i.type === 'booking' && i.booking.status === 'requested').length;
  const ev = items.filter((i) => i.type === 'personal').length;
  const off = items.some((i) => i.type === 'unavailable');
  return [
    n ? `${n} intervention${n > 1 ? 's' : ''}` : 'aucune intervention',
    req ? `${req} demande${req > 1 ? 's' : ''} à traiter` : null,
    ev ? `${ev} événement${ev > 1 ? 's' : ''}` : null,
    off ? 'indisponible' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function DayAgenda({
  day,
  planning,
  items,
}: {
  day: Date;
  planning: PlanningDto;
  items: PlanningItem[];
}) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<AvailabilityExceptionDto | null>(null);
  const [actions, setActions] = useState<AvailabilityExceptionDto | null>(null);
  const rules = planning.rules
    .filter((r) => r.weekday === day.getDay())
    .sort((a, b) => a.start.localeCompare(b.start));
  const allDay = items.filter((i) => i.type !== 'booking' && i.allDay);
  const rows = timelineRows(items, { day });

  const del = useMutation({
    mutationFn: (id: string) => api.artisan.deleteException(id),
    onSuccess: () => {
      toast.success(
        toDelete?.kind === 'personal' ? 'Événement supprimé.' : 'Indisponibilité supprimée.',
      );
      setToDelete(null);
      void qc.invalidateQueries({ queryKey: PLANNING_PREFIX });
      void qc.invalidateQueries({ queryKey: qk.artisan.exceptions });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const openItem = (i: PlanningItem) => {
    if (i.type === 'booking')
      router.push({ pathname: '/pro/interventions/[id]', params: { id: i.booking.id } });
    else if (i.type === 'personal') setActions(i.exception);
    else setToDelete(i.exception);
  };

  return (
    <View style={{ gap: t.spacing.md }} testID="day-agenda">
      <Text variant="title2" accessibilityRole="header">
        {dayLong(day)}
      </Text>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
        <Clock size={16} color={t.colors.text.secondary} />
        <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
          {rules.length
            ? `${WEEKDAY_LABELS[day.getDay()]} : ${rules.map((r) => `${r.start}–${r.end}`).join(' · ')}`
            : `${WEEKDAY_LABELS[day.getDay()]} : fermé (horaires types)`}
        </Text>
      </View>
      {allDay.map((i) => (
        <ItemCard key={i.id} item={i} onPress={() => openItem(i)} />
      ))}
      {items.length === allDay.length && !allDay.length ? (
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
      <View>
        {rows.map((r) => (
          <View key={r.hour} style={{ gap: t.spacing.sm, paddingBottom: t.spacing.md }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}
              accessibilityElementsHidden={!r.items.length}
              importantForAccessibility={r.items.length ? 'auto' : 'no-hide-descendants'}
            >
              <Text variant="bodyStrong" style={{ width: 52 }}>
                {`${r.hour}:00`}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border.subtle }} />
            </View>
            {r.items.map((i) => (
              <View key={i.id} style={{ marginLeft: 64 }}>
                <ItemCard item={i} onPress={() => openItem(i)} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <BottomSheet
        visible={!!actions}
        onClose={() => setActions(null)}
        title={actions?.reason || 'Événement'}
        description={actions ? exceptionLabel(actions) : undefined}
      >
        <ListItem
          title="Modifier"
          icon={Pencil}
          onPress={() => {
            const id = actions?.id;
            setActions(null);
            if (id) router.push({ pathname: '/pro/planning/evenement', params: { id } });
          }}
          testID="event-edit"
        />
        <ListItem
          title="Supprimer"
          icon={Trash2}
          destructive
          onPress={() => {
            const e = actions;
            setActions(null);
            setToDelete(e);
          }}
          testID="event-delete"
        />
      </BottomSheet>
      <ConfirmSheet
        visible={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
        loading={del.isPending}
        title={
          toDelete?.kind === 'personal'
            ? `Supprimer « ${toDelete.reason || 'Événement'} » ?`
            : 'Supprimer cette indisponibilité ?'
        }
        message="Ces créneaux redeviendront réservables par les clients."
        confirmLabel="Supprimer"
        tone="danger"
      />
    </View>
  );
}

/** Carte d'un élément de la frise : horaire, pastille, titre, marqueurs (demande, note privée). */
function ItemCard({ item: i, onPress }: { item: PlanningItem; onPress: () => void }) {
  const t = useTheme();
  const time =
    i.type !== 'booking' && i.allDay
      ? exceptionLabel(i.exception)
      : `${shortTime(i.start)} - ${shortTime(i.end)}`;
  let dot: DayDot;
  let title: string;
  let a11y: string;
  let tag: { label: string; tone: 'warning' | 'info' } | null = null;
  let note: string | null = null;
  if (i.type === 'booking') {
    const b = i.booking;
    dot = {
      key: b.id,
      type: 'domain',
      domain: b.domain,
      urgent: b.kind === 'urgent',
      requested: b.status === 'requested',
    };
    title = bookingTitle(b);
    if (b.status === 'requested') tag = { label: 'Demande', tone: 'warning' };
    else if (b.status === 'pending_payment' && b.artisanAccepted)
      tag = { label: 'Attente client', tone: 'info' };
    note = b.artisanNote;
    a11y = `${b.kind === 'urgent' ? 'Urgence' : 'Rendez-vous'}, ${time}, ${title}${tag ? `, ${tag.label}` : ''}${note ? `, note : ${note}` : ''}`;
  } else if (i.type === 'personal') {
    dot = { key: i.id, type: 'event', color: i.exception.color ?? 'blue' };
    title = i.exception.reason || 'Événement personnel';
    a11y = `Événement personnel, ${time}, ${title}, couleur ${EVENT_COLOR_LABELS[i.exception.color ?? 'blue'].toLowerCase()}`;
  } else {
    dot = { key: i.id, type: 'unavailable' };
    title = i.exception.reason || 'Indisponible';
    a11y = `Indisponibilité, ${time}, ${title}`;
  }
  const bg =
    i.type === 'personal'
      ? eventColor(i.exception.color, t).soft
      : i.type === 'unavailable'
        ? t.colors.background.subtle
        : t.colors.brand.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={
        i.type === 'booking'
          ? "Ouvre le détail de l'intervention"
          : i.type === 'personal'
            ? 'Modifier ou supprimer'
            : "Supprimer l'indisponibilité"
      }
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: t.radius.md,
        padding: t.spacing.md,
        gap: 2,
        opacity: pressed ? 0.85 : 1,
        borderWidth: i.type === 'booking' && i.booking.status === 'requested' ? 1 : 0,
        borderColor: t.colors.tone.warning.solid,
        borderStyle: 'dashed',
      })}
      testID={`planning-item-${i.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        <Text variant="callout">{time}</Text>
        <Dot dot={dot} size={8} />
        {i.type === 'booking' && i.booking.kind === 'urgent' ? (
          <Siren size={14} color={t.colors.tone.urgent.text} />
        ) : null}
        {i.type === 'unavailable' ? (
          <CalendarOff size={14} color={t.colors.text.secondary} />
        ) : null}
        <View style={{ flex: 1 }} />
        {tag ? <Badge label={tag.label} tone={tag.tone} /> : null}
      </View>
      <Text variant="bodyStrong" numberOfLines={2}>
        {title}
      </Text>
      {note ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          <StickyNote size={14} color={t.colors.text.secondary} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {note}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function LegendSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const row = (dot: DayDot, label: string) => (
    <View key={dot.key} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      <View style={{ width: 16, alignItems: 'center' }}>
        <Dot dot={dot} size={10} />
      </View>
      <Text>{label}</Text>
    </View>
  );
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Légende">
      <View style={{ gap: t.spacing.md }}>
        {DOMAIN_CODES.map((d) =>
          row(
            { key: d, type: 'domain', domain: d, urgent: false, requested: false },
            `Rendez-vous ${DOMAIN_LABELS[d].toLowerCase()}`,
          ),
        )}
        {features.urgent
          ? row(
              {
                key: 'urgent',
                type: 'domain',
                domain: 'plomberie',
                urgent: true,
                requested: false,
              },
              'Urgence (carré)',
            )
          : null}
        {row(
          { key: 'requested', type: 'domain', domain: 'plomberie', urgent: false, requested: true },
          'Demande à traiter (anneau)',
        )}
        {row(
          { key: 'event', type: 'event', color: 'green' },
          'Événement personnel (couleur choisie)',
        )}
        {row({ key: 'off', type: 'unavailable' }, 'Indisponibilité')}
        <Card
          variant="flat"
          style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}
        >
          <StickyNote size={18} color={t.colors.text.secondary} />
          <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
            Note privée : visible par vous seul, jamais par le client.
          </Text>
        </Card>
      </View>
    </BottomSheet>
  );
}
