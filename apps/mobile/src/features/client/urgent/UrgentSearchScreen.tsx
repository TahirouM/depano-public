import { DOMAIN_LABELS, RULES } from '@depano/schemas';
import { Avatar, Button, Card, ConfirmSheet, EmptyState, ErrorState, Screen, Skeleton, Text, formatDateTime, haptic, useTheme, useToast } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useNavigation } from 'expo-router';
import { CalendarClock, CircleX, SearchX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { askPermission } from '@/lib/permissions';
import { qk } from '@/lib/query/keys';
import { useBookingLive } from '@/lib/realtime/hooks';
import { useAppStore } from '@/stores/app';
import { SearchPulse } from '../components/SearchPulse';
import { prefillScheduledDraft, prefillUrgentDraft } from '../drafts';
import { useArtisanSearch } from '../queries';
import { useLeaveFlow } from '../navigation';

/** Urgence 5 : recherche d'un artisan en direct (vagues de dispatch), état « aucun preneur ». */
export function UrgentSearchScreen({ bookingId }: { bookingId: string }) {
  const t = useTheme();
  const leaveFlowTo = useLeaveFlow();
  const qc = useQueryClient();
  const toast = useToast();
  const live = useBookingLive(bookingId);
  const b = live.data;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const asked = useRef(false);

  // Notifications demandées juste après la première réservation (pour suivre l'arrivée).
  useEffect(() => {
    if (asked.current || Platform.OS === 'web' || useAppStore.getState().permissionAsked.notifications) return;
    asked.current = true;
    const id = setTimeout(() => void askPermission('notifications', "Pour suivre l'arrivée de l'artisan"), 1200);
    return () => clearTimeout(id);
  }, []);

  // Retour tactile « succès » une seule fois, au passage recherche → artisan trouvé
  // (pas au premier chargement si la demande était déjà acceptée).
  const prevStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = b?.status;
    if (!status) return;
    const found = status === 'accepted' || status === 'en_route';
    if (prevStatus.current && (prevStatus.current === 'searching' || prevStatus.current === 'pending_payment') && found) haptic('success');
    prevStatus.current = status;
  }, [b?.status]);

  // Un artisan a accepté : on passe au suivi en direct.
  const navigation = useNavigation();
  const redirected = useRef(false);
  useEffect(() => {
    if (!b || redirected.current || !navigation.isFocused()) return;
    if (b.status === 'accepted' || b.status === 'en_route') {
      redirected.current = true;
      router.replace({ pathname: '/urgence/[bookingId]/suivi', params: { bookingId } });
    } else if (!['searching', 'pending_payment', 'expired', 'cancelled_by_client'].includes(b.status)) {
      redirected.current = true;
      leaveFlowTo({ pathname: '/activite/[id]', params: { id: bookingId } });
    }
  }, [b, bookingId, navigation, leaveFlowTo]);

  const expired = b?.status === 'expired';
  const alternative = useArtisanSearch(
    { domain: b?.domain, lat: b?.address.lat ?? b?.address.approxLat, lng: b?.address.lng ?? b?.address.approxLng, sort: 'distance', limit: 10 },
    { enabled: expired },
  );
  const next = alternative.data?.items.filter((a) => a.nextSlotAt).sort((x, y) => x.nextSlotAt!.localeCompare(y.nextSlotAt!))[0];

  const cancel = async () => {
    setCancelling(true);
    try {
      const updated = await api.bookings.cancel(bookingId, { reason: 'Recherche annulée par le client' });
      qc.setQueryData(qk.bookings.detail(bookingId), updated);
      void qc.invalidateQueries({ queryKey: qk.bookings.lists });
      setConfirmCancel(false);
      toast.success('Demande annulée. Aucun montant ne vous sera prélevé.');
      leaveFlowTo('/accueil');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCancelling(false);
    }
  };

  const header = <Stack.Screen options={{ title: 'Recherche d’un artisan', headerShown: true, headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />;

  if (!b) {
    if (live.isError) {
      return (
        <Screen>
          {header}
          <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refetch()} />
        </Screen>
      );
    }
    return (
      <Screen>
        {header}
        <View style={{ alignItems: 'center', gap: t.spacing.lg, paddingTop: t.spacing.xxl }}>
          <Skeleton width={220} height={220} radius={110} />
          <Skeleton width="70%" height={24} />
          <Skeleton width="50%" />
        </View>
      </Screen>
    );
  }

  if (expired) {
    return (
      <Screen
        footer={
          <View style={{ gap: t.spacing.sm }}>
            {next ? (
              <Button
                size="lg"
                fullWidth
                icon={CalendarClock}
                label="Réserver ce créneau"
                onPress={() => {
                  prefillScheduledDraft(next.id, b);
                  router.replace({ pathname: '/rdv/type', params: { artisanId: next.id } });
                }}
                testID="expired-book-slot"
              />
            ) : null}
            <Button
              variant={next ? 'secondary' : 'urgent'}
              size="lg"
              fullWidth
              label="Relancer une demande d'urgence"
              onPress={() => {
                prefillUrgentDraft(b);
                router.replace('/urgence/paiement');
              }}
            />
            <Button variant="ghost" fullWidth label="Retour à l'accueil" onPress={() => leaveFlowTo('/accueil')} />
          </View>
        }
      >
        {header}
        <View style={{ gap: t.spacing.xl }} testID="search-expired">
          <EmptyState
            icon={SearchX}
            title="Aucun artisan disponible pour le moment"
            message="Aucun montant ne vous a été prélevé : votre empreinte bancaire est libérée."
          />
          <Card style={{ gap: t.spacing.md }}>
            <Text variant="overline" tone="secondary">
              Premier créneau disponible
            </Text>
            {alternative.isPending ? (
              <Skeleton height={48} />
            ) : next ? (
              <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
                <Avatar name={next.displayName} uri={next.avatarUrl} size={48} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{next.displayName}</Text>
                  <Text tone="secondary" variant="callout">
                    {formatDateTime(next.nextSlotAt!)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text tone="secondary">Pas de créneau proche pour l'instant. Réessayez dans quelques minutes.</Text>
            )}
          </Card>
        </View>
      </Screen>
    );
  }

  if (b.status === 'cancelled_by_client') {
    return (
      <Screen footer={<Button size="lg" fullWidth label="Retour à l'accueil" onPress={() => leaveFlowTo('/accueil')} />}>
        {header}
        <EmptyState fill icon={CircleX} title="Demande annulée" message="Aucun montant ne vous a été prélevé." />
      </Screen>
    );
  }

  const contacted = b.dispatch?.contacted ?? 0;
  const wave = b.dispatch?.wave ?? 0;
  const radius = b.dispatch?.radiusKm ?? RULES.dispatch.radiiKm[0];
  return (
    <Screen
      footer={<Button variant="ghost" fullWidth label="Annuler la demande" onPress={() => setConfirmCancel(true)} testID="cancel-search" />}
    >
      {header}
      <View style={{ flex: 1, alignItems: 'center', gap: t.spacing.xl, paddingTop: t.spacing.xl }} testID="search-live">
        <SearchPulse domain={b.domain} />
        <View style={{ gap: t.spacing.sm, alignItems: 'center' }} accessibilityLiveRegion="polite" accessible>
          <Text variant="title1" align="center">
            {contacted > 0 ? `${contacted} artisan${contacted > 1 ? 's' : ''} contacté${contacted > 1 ? 's' : ''}…` : 'Recherche en cours…'}
          </Text>
          <Text tone="secondary" align="center">
            Le premier qui accepte arrive.
          </Text>
        </View>
        <Card variant="flat" style={{ alignSelf: 'stretch', gap: t.spacing.xs }}>
          <Text variant="bodyStrong">
            {DOMAIN_LABELS[b.domain]} · {b.problemReason}
          </Text>
          <Text variant="callout" tone="secondary">
            {wave > 0 ? `Vague ${wave} sur ${RULES.dispatch.radiiKm.length} · rayon de ${radius} km` : 'Préparation de la recherche'} · {b.city}
          </Text>
          <Text variant="callout" tone="secondary">
            Annulation gratuite pendant la recherche. Rien n'est prélevé maintenant.
          </Text>
        </Card>
      </View>
      <ConfirmSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void cancel()}
        loading={cancelling}
        title="Annuler la demande ?"
        message="La recherche s'arrête et votre empreinte bancaire est libérée. C'est gratuit."
        confirmLabel="Annuler la demande"
        cancelLabel="Continuer la recherche"
        tone="danger"
      />
    </Screen>
  );
}
