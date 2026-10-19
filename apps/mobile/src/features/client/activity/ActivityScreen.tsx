import type { BookingSummaryDto, Paginated } from '@depano/schemas';
import { InterventionCard, SegmentedControl, SkeletonList, useTheme } from '@depano/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ClipboardList, History } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { interventionHref } from '@/components/PinnedInterventionHost';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';
import { useIsSignedIn } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';

type Scope = 'active' | 'past';

function useClientBookings(scope: Scope) {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: [...qk.bookings.list({ as: 'client', scope }), 'infinite'],
    queryFn: ({ pageParam }) => api.bookings.list({ as: 'client', scope, cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<BookingSummaryDto>) => last.nextCursor ?? undefined,
    enabled: signedIn,
  });
}

/** Activité : interventions en cours / passées (RDV et urgences). */
export function ActivityScreen() {
  return (
    <AuthGate icon={ClipboardList} title="Vos interventions" message="Connectez-vous pour retrouver vos rendez-vous, urgences et factures.">
      <ActivityInner />
    </AuthGate>
  );
}

function ActivityInner() {
  const t = useTheme();
  const [scope, setScope] = useState<Scope>('active');
  const q = useClientBookings(scope);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background.canvas }} testID="activity">
      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
        <SegmentedControl
          accessibilityLabel="Période"
          options={[
            { value: 'active', label: 'En cours' },
            { value: 'past', label: 'Passées' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </View>
      <QueryView
        query={q}
        loading={
          <View style={{ padding: t.spacing.lg }}>
            <SkeletonList count={3} />
          </View>
        }
        isEmpty={(d) => d.pages.every((p) => p.items.length === 0)}
        empty={
          scope === 'active'
            ? {
                icon: ClipboardList,
                title: 'Aucune intervention en cours',
                message: 'Une fuite, une panne ? Un artisan vérifié chez vous au plus vite.',
                action: { label: 'Demander une urgence', onPress: () => router.push('/urgence/domaine'), variant: 'urgent' },
                secondaryAction: { label: 'Prendre rendez-vous', onPress: () => router.push('/recherche') },
              }
            : { icon: History, title: 'Aucune intervention passée', message: 'Vos interventions terminées et annulées apparaîtront ici, avec leurs factures.' }
        }
      >
        {(data) => (
          <FlatList
            data={data.pages.flatMap((p) => p.items)}
            keyExtractor={(b) => b.id}
            contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xxxl }}
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => void q.refetch()}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
            }}
            ListFooterComponent={q.isFetchingNextPage ? <SkeletonList count={1} /> : undefined}
            renderItem={({ item }) => <InterventionCard booking={item} onPress={() => router.push(interventionHref(item, 'client'))} />}
          />
        )}
      </QueryView>
    </View>
  );
}
