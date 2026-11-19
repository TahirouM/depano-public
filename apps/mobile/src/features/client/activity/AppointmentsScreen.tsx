import type { BookingSummaryDto, Paginated } from '@depano/schemas';
import { Button, EmptyState, ErrorState, SectionHeader, SkeletonList, StaggerItem, Text, useTheme } from '@depano/ui';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, CalendarPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { HeaderBell } from '@/components/HeaderBell';
import { api, errorMessage, isNetworkError } from '@/lib/api';
import { features } from '@/lib/env';
import { useBooking, useConversations, useIsSignedIn } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { CancelSheet } from '../components/CancelSheet';
import { HeroSheetLayout } from '../components/HeroSheetLayout';
import { AppointmentCard } from './AppointmentCard';
import { proposalOf } from './bookingState';

function useActiveAppointments() {
  const signedIn = useIsSignedIn();
  return useInfiniteQuery({
    queryKey: [...qk.bookings.list({ as: 'client', scope: 'active' }), 'infinite'],
    queryFn: ({ pageParam }) => api.bookings.list({ as: 'client', scope: 'active', cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Paginated<BookingSummaryDto>) => last.nextCursor ?? undefined,
    enabled: signedIn,
  });
}

/**
 * Onglet « Rendez-vous » : demandes en attente de l'artisan, propositions à accepter (prix, nouveau
 * rendez-vous), rendez-vous et urgences en cours. Même habillage que l'accueil.
 */
export function AppointmentsScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const signedIn = useIsSignedIn();
  // Le périmètre « active » de l'API inclut les propositions de l'artisan (prix, report) à valider.
  const active = useActiveAppointments();
  const conversations = useConversations();
  const [cancelId, setCancelId] = useState<string | null>(null);

  const items = useMemo(() => active.data?.pages.flatMap((p) => p.items) ?? [], [active.data]);
  const conversationOf = useMemo(() => new Map((conversations.data ?? []).map((c) => [c.bookingId, c.id] as const)), [conversations.data]);
  const proposals = items.filter((b) => proposalOf(b));
  const upcoming = items.filter((b) => !proposalOf(b));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.bookings.lists });
    void qc.invalidateQueries({ queryKey: qk.chat.conversations });
  };
  const book = () => router.push('/recherche');

  // Apparition échelonnée : `offset` poursuit l'index d'une section à l'autre.
  const renderList = (list: BookingSummaryDto[], offset = 0) =>
    list.map((b, i) => (
      <StaggerItem key={b.id} index={offset + i}>
        <AppointmentCard booking={b} conversationId={conversationOf.get(b.id) ?? null} onCancel={setCancelId} />
      </StaggerItem>
    ));

  return (
    <HeroSheetLayout
      testID="appointments"
      refreshing={active.isRefetching && !active.isFetchingNextPage}
      onRefresh={signedIn ? refresh : undefined}
      onEndReached={() => {
        if (active.hasNextPage && !active.isFetchingNextPage) void active.fetchNextPage();
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
            Mes rendez-vous
          </Text>
          <Text tone="secondary">Vos demandes, rendez-vous à venir et interventions en cours.</Text>
        </View>
      }
    >
      <AuthGate icon={CalendarDays} title="Vos rendez-vous" message="Connectez-vous pour retrouver vos demandes de rendez-vous et vos interventions en cours.">
        {active.data ? (
          items.length ? (
            <View style={{ gap: t.spacing.xl }}>
              {proposals.length ? (
                <View style={{ gap: t.spacing.md }}>
                  <SectionHeader title="À valider" />
                  {renderList(proposals)}
                </View>
              ) : null}
              {upcoming.length ? (
                <View style={{ gap: t.spacing.md }}>
                  {proposals.length ? <SectionHeader title="À venir" /> : null}
                  {renderList(upcoming, proposals.length)}
                </View>
              ) : null}
              {active.isFetchingNextPage ? <SkeletonList count={1} /> : null}
              <Button variant="secondary" size="lg" fullWidth icon={CalendarPlus} label="Prendre un rendez-vous" onPress={book} testID="appointments-book" />
            </View>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Aucun rendez-vous"
              message="Choisissez un artisan vérifié et un créneau : il confirme votre demande, vous ne payez qu'à la fin."
              action={{ label: 'Prendre un rendez-vous', onPress: book }}
              secondaryAction={features.urgent ? { label: 'Demander une urgence', onPress: () => router.push('/urgence/domaine') } : undefined}
            />
          )
        ) : active.isError ? (
          <ErrorState fill={false} offline={isNetworkError(active.error)} message={errorMessage(active.error)} onRetry={() => void active.refetch()} />
        ) : (
          <SkeletonList count={3} />
        )}
      </AuthGate>
      {cancelId ? <CancelFromList id={cancelId} onClose={() => setCancelId(null)} /> : null}
    </HeroSheetLayout>
  );
}

/** Annulation depuis la liste : le détail (frais, garantie) est chargé avant d'ouvrir la feuille. */
function CancelFromList({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useBooking(id);
  if (!q.data) return null;
  return <CancelSheet booking={q.data} visible onClose={onClose} />;
}
