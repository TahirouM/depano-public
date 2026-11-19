import { formatEuros, type BookingSummaryDto, type Paginated } from '@depano/schemas';
import { Avatar, Button, Card, EmptyState, ErrorState, SkeletonList, StaggerItem, Text, formatDateLong, useTheme } from '@depano/ui';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { History, Wrench } from 'lucide-react-native';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { HeaderBell } from '@/components/HeaderBell';
import { api, errorMessage, isNetworkError } from '@/lib/api';
import { useIsSignedIn } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { HeroSheetLayout } from '../components/HeroSheetLayout';
import { isHistoryItem, kindDomainLabel } from './bookingState';

function usePastBookings() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: [...qk.bookings.list({ as: 'client', scope: 'past' }), 'infinite'],
    queryFn: ({ pageParam }) => api.bookings.list({ as: 'client', scope: 'past', cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<BookingSummaryDto>) => last.nextCursor ?? undefined,
    enabled: signedIn,
  });
}

/** Une intervention réalisée : artisan, « Urgence Plomberie », date, montant, « Voir plus ». */
function HistoryRow({ booking: b }: { booking: BookingSummaryDto }) {
  const t = useTheme();
  const name = b.counterpart?.name ?? 'Artisan';
  const cancelled = b.status === 'cancelled_by_client' || b.status === 'cancelled_by_artisan';
  const open = () => router.push({ pathname: '/interventions/[id]', params: { id: b.id } });
  return (
    <Card padding="md" style={{ gap: t.spacing.md }} testID={`history-${b.id}`}>
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Avatar name={name} uri={b.counterpart?.avatarUrl ?? null} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {kindDomainLabel(b)}
          </Text>
          <Text variant="callout">{formatDateLong(b.scheduledAt ?? b.createdAt).replace(/^./, (c) => c.toUpperCase())}</Text>
          {cancelled ? (
            <Text variant="caption" tone="warning">
              Annulée
            </Text>
          ) : null}
        </View>
        {cancelled ? null : (
          <Text variant="title2" accessibilityLabel={`Montant : ${formatEuros(b.totalCents)}`}>
            {formatEuros(b.totalCents)}
          </Text>
        )}
      </View>
      <Button variant="secondary" size="sm" label="Voir plus" onPress={open} accessibilityHint={`Détail de l'intervention avec ${name}`} testID="history-open" />
    </Card>
  );
}

/** Onglet « Interventions » : historique des interventions réalisées (et annulées après prise en charge). */
export function HistoryScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const signedIn = useIsSignedIn();
  const q = usePastBookings();
  const items = (q.data?.pages.flatMap((p) => p.items) ?? []).filter(isHistoryItem);

  return (
    <HeroSheetLayout
      testID="history"
      refreshing={q.isRefetching && !q.isFetchingNextPage}
      onRefresh={signedIn ? () => void qc.invalidateQueries({ queryKey: qk.bookings.lists }) : undefined}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      topBar={
        <>
          <View />
          <HeaderBell />
        </>
      }
      hero={
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="display" accessibilityRole="header">
            Interventions réalisées
          </Text>
          <Text tone="secondary">Comptes rendus, factures et avis de vos interventions passées.</Text>
        </View>
      }
    >
      <AuthGate icon={Wrench} title="Vos interventions" message="Connectez-vous pour retrouver l'historique de vos interventions, leurs comptes rendus et factures.">
        {q.data ? (
          items.length ? (
            <View style={{ gap: t.spacing.md }}>
              {items.map((b, i) => (
                <StaggerItem key={b.id} index={i}>
                  <HistoryRow booking={b} />
                </StaggerItem>
              ))}
              {q.isFetchingNextPage ? <SkeletonList count={1} /> : null}
            </View>
          ) : (
            <EmptyState
              icon={History}
              title="Aucune intervention réalisée"
              message="Vos interventions terminées apparaîtront ici, avec leur compte rendu et leur facture."
              action={{ label: 'Trouver un artisan', onPress: () => router.push('/recherche') }}
            />
          )
        ) : q.isError ? (
          <ErrorState fill={false} offline={isNetworkError(q.error)} message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <SkeletonList count={3} />
        )}
      </AuthGate>
    </HeroSheetLayout>
  );
}
