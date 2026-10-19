import type { NotificationDto, NotificationType } from '@depano/schemas';
import { Button, Chip, Icon, Screen, SkeletonList, Text, formatTime, relativeDayLabel, dayKey, useTheme, type LucideIcon } from '@depano/ui';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { Bell, Briefcase, CalendarClock, MessageCircle, Siren, Star, Wallet, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import type { Paginated } from '@depano/schemas';
import { AuthGate } from '@/components/AuthGate';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { resolveDeepLink } from '@/lib/deepLinks';
import { useNotificationsFeed } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { useAppStore } from '@/stores/app';

type Filter = 'all' | 'unread' | 'bookings' | 'messages';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'unread', label: 'Non lues' },
  { value: 'bookings', label: 'Interventions' },
  { value: 'messages', label: 'Messages' },
];

const BOOKING_TYPES = new Set<NotificationType>([
  'booking_created',
  'booking_accepted',
  'booking_status',
  'booking_cancelled',
  'booking_expired',
  'urgent_offer',
  'quote_received',
  'quote_answered',
  'reminder',
]);

const ICONS: Partial<Record<NotificationType, LucideIcon>> = {
  urgent_offer: Siren,
  message: MessageCircle,
  review_received: Star,
  reminder: CalendarClock,
  payout: Wallet,
  artisan_approved: Briefcase,
  artisan_rejected: Briefcase,
};

type Feed = InfiniteData<Paginated<NotificationDto>, string | undefined>;

/** Fil de notifications groupé par jour, avec filtres. */
export function NotificationsScreen() {
  return (
    <Screen scroll={false} padded={false}>
      <AuthGate icon={Bell} title="Vos notifications" message="Connectez-vous pour suivre vos interventions en temps réel.">
        <Feed />
      </AuthGate>
    </Screen>
  );
}

function Feed() {
  const t = useTheme();
  const qc = useQueryClient();
  const q = useNotificationsFeed();
  const role = useAppStore((s) => s.activeRole);
  const [filter, setFilter] = useState<Filter>('all');

  const markOne = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onMutate: (id) => {
      const now = new Date().toISOString();
      qc.setQueryData<Feed>(qk.notifications.list, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? now } : n)) })) } : old,
      );
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.badges }),
  });
  const markAll = useMutation({
    mutationFn: api.notifications.markAllRead,
    onMutate: () => {
      const now = new Date().toISOString();
      qc.setQueryData<Feed>(qk.notifications.list, (old) =>
        old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: p.items.map((n) => ({ ...n, readAt: n.readAt ?? now })) })) } : old,
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.badges });
      void qc.invalidateQueries({ queryKey: qk.notifications.list });
    },
  });

  const all = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.items), [q.data]);
  const sections = useMemo(() => {
    const filtered = all.filter((n) =>
      filter === 'unread' ? !n.readAt : filter === 'bookings' ? BOOKING_TYPES.has(n.type) : filter === 'messages' ? n.type === 'message' : true,
    );
    const groups = new Map<string, { title: string; data: NotificationDto[] }>();
    for (const n of filtered) {
      const k = dayKey(n.createdAt);
      if (!groups.has(k)) groups.set(k, { title: relativeDayLabel(n.createdAt), data: [] });
      groups.get(k)!.data.push(n);
    }
    return [...groups.values()];
  }, [all, filter]);
  const unread = all.filter((n) => !n.readAt).length;

  const open = (n: NotificationDto) => {
    if (!n.readAt) markOne.mutate(n.id);
    const href = resolveDeepLink(n.link, role);
    if (href && href !== '/notifications') router.push(href as Href);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            unread > 0 ? <Button label="Tout lire" variant="ghost" size="sm" onPress={() => markAll.mutate()} accessibilityLabel="Tout marquer comme lu" /> : null,
        }}
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filters, { paddingHorizontal: t.spacing.lg, gap: t.spacing.sm }]}>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>
      <QueryView
        query={q}
        loading={<SkeletonList variant="row" count={6} />}
        isEmpty={(d) => d.pages.every((p) => p.items.length === 0)}
        empty={{ icon: Bell, title: 'Aucune notification pour l’instant', message: 'Vous serez prévenu ici à chaque étape de vos interventions.' }}
      >
        {() =>
          sections.length === 0 ? (
            <Text tone="secondary" align="center" style={{ padding: t.spacing.xl }}>
              Rien dans ce filtre.
            </Text>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(n) => n.id}
              stickySectionHeadersEnabled={false}
              refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={t.colors.brand.primary} />}
              onEndReached={() => {
                if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
              }}
              renderSectionHeader={({ section }) => (
                <Text variant="overline" tone="secondary" accessibilityRole="header" style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg, paddingBottom: t.spacing.xs }}>
                  {section.title}
                </Text>
              )}
              renderItem={({ item: n }) => {
                const icon = ICONS[n.type] ?? (BOOKING_TYPES.has(n.type) ? Wrench : Bell);
                const isUnread = !n.readAt;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${isUnread ? 'Non lue. ' : ''}${n.title}. ${n.body}. ${formatTime(n.createdAt)}`}
                    onPress={() => open(n)}
                    style={({ pressed }) => [
                      styles.row,
                      { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, gap: t.spacing.md, backgroundColor: pressed ? t.colors.background.subtle : isUnread ? t.colors.background.surface : 'transparent' },
                    ]}
                  >
                    <View style={[styles.icon, { backgroundColor: n.type === 'urgent_offer' ? t.colors.tone.urgent.soft : t.colors.background.brand }]}>
                      <Icon icon={icon} size={20} color={n.type === 'urgent_offer' ? t.colors.tone.urgent.text : t.colors.text.brand} />
                    </View>
                    <View style={styles.flex}>
                      <Text variant={isUnread ? 'bodyStrong' : 'body'}>{n.title}</Text>
                      <Text variant="callout" tone="secondary">
                        {n.body}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {formatTime(n.createdAt)}
                      </Text>
                    </View>
                    {isUnread ? <View style={[styles.dot, { backgroundColor: t.colors.tone.urgent.solid }]} accessibilityElementsHidden /> : null}
                  </Pressable>
                );
              }}
            />
          )
        }
      </QueryView>
    </>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 8 },
});
