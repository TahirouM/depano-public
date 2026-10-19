import { Button, Card, EmptyState, ErrorState, Icon, Screen, Skeleton, StatusChip, Text, useTheme } from '@depano/ui';
import { router, Stack, useNavigation } from 'expo-router';
import { Clock, UserX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { useBookingLive } from '@/lib/realtime/hooks';
import { ArtisanContact } from '../components/ArtisanContact';
import { CancelSheet } from '../components/CancelSheet';
import { CompletionCode } from '../components/CompletionCode';
import { prefillUrgentDraft } from '../drafts';
import { LiveMap } from '../map/LiveMap';
import { useLeaveFlow } from '../navigation';

const firstName = (n: string | undefined) => n?.split(' ')[0] ?? "L'artisan";

/** Urgence 6 : suivi en direct (carte, ETA, artisan, appel/chat), retard, annulation artisan. */
export function UrgentTrackingScreen({ bookingId }: { bookingId: string }) {
  const t = useTheme();
  const leaveFlowTo = useLeaveFlow();
  const live = useBookingLive(bookingId);
  const b = live.data;
  const [cancelOpen, setCancelOpen] = useState(false);

  const navigation = useNavigation();
  const redirected = useRef(false);
  // Arrivé (ou au-delà) : le détail de l'intervention prend le relais (devis, code…). Une seule fois,
  // et seulement si l'écran est affiché (il peut rester monté sous la pile des onglets).
  useEffect(() => {
    if (!b || redirected.current || !navigation.isFocused()) return;
    if (['arrived', 'quote_pending', 'in_progress', 'awaiting_code', 'closed', 'disputed'].includes(b.status)) {
      redirected.current = true;
      leaveFlowTo({ pathname: '/activite/[id]', params: { id: bookingId } });
    } else if (b.status === 'searching') {
      redirected.current = true;
      router.replace({ pathname: '/urgence/[bookingId]/recherche', params: { bookingId } });
    }
  }, [b, bookingId, navigation, leaveFlowTo]);

  const header = <Stack.Screen options={{ title: 'Suivi en direct', headerShown: true }} />;
  if (!b) {
    return (
      <Screen>
        {header}
        {live.isError ? (
          <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refetch()} />
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            <Skeleton height={260} radius={t.radius.md} />
            <Skeleton width="70%" height={28} />
            <Skeleton height={120} radius={t.radius.md} />
          </View>
        )}
      </Screen>
    );
  }

  const name = firstName(b.artisan?.displayName);
  if (b.status === 'cancelled_by_artisan') {
    return (
      <Screen
        footer={
          <View style={{ gap: t.spacing.sm }}>
            <Button
              variant="urgent"
              size="lg"
              fullWidth
              label="Relancer la recherche"
              onPress={() => {
                prefillUrgentDraft(b);
                router.replace('/urgence/paiement');
              }}
              testID="relaunch-search"
            />
            <Button variant="ghost" fullWidth label="Retour à l'accueil" onPress={() => leaveFlowTo('/accueil')} />
          </View>
        }
      >
        {header}
        <EmptyState
          fill
          icon={UserX}
          title={`${name} a dû annuler`}
          message="Ce n'est pas de votre faute. Votre empreinte est libérée et votre demande est prioritaire pour un autre artisan."
        />
      </Screen>
    );
  }
  if (b.status === 'cancelled_by_client') {
    return (
      <Screen footer={<Button size="lg" fullWidth label="Retour à l'accueil" onPress={() => leaveFlowTo('/accueil')} />}>
        {header}
        <EmptyState fill title="Intervention annulée" message={b.cancellationFeeCents ? 'Seuls les frais de déplacement ont été prélevés.' : 'Aucun montant ne vous a été prélevé.'} />
      </Screen>
    );
  }

  const dest = b.address.lat != null && b.address.lng != null ? { lat: b.address.lat, lng: b.address.lng } : { lat: b.address.approxLat, lng: b.address.approxLng };
  const eta = b.etaMinutes;
  const headline =
    b.status === 'en_route'
      ? eta != null
        ? eta <= 1
          ? `${name} arrive dans un instant.`
          : `${name} arrive dans ${eta} min.`
        : `${name} est en route.`
      : `${name} a accepté votre demande.`;
  const sub = b.status === 'accepted' ? 'Il se prépare à partir. Vous verrez sa position dès son départ.' : 'Position mise à jour en direct.';
  // L'API rend l'annulation gratuite quand l'artisan dépasse l'ETA de plus de 30 min.
  const late = b.status === 'en_route' && b.cancellationIsFree && !b.withGuarantee;
  const canCancel = b.allowedTransitions.includes('cancelled_by_client');

  return (
    <Screen
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Button variant="secondary" fullWidth label="Voir le détail de l'intervention" onPress={() => leaveFlowTo({ pathname: '/activite/[id]', params: { id: b.id } })} />
          {canCancel ? <Button variant="ghost" fullWidth label="Annuler l'intervention" onPress={() => setCancelOpen(true)} testID="tracking-cancel" /> : null}
        </View>
      }
    >
      {header}
      <View style={{ gap: t.spacing.lg }} testID="tracking">
        <LiveMap
          center={dest}
          destination={dest}
          artisan={b.artisanLocation}
          artisanName={b.artisan?.displayName}
          overlayLabel={b.status === 'en_route' && eta != null ? (eta <= 1 ? 'Arrive' : `${eta} min`) : null}
          accessibilityLabel={b.artisanLocation ? `Carte : ${headline}` : "Carte de l'adresse d'intervention"}
        />
        <View style={{ gap: t.spacing.xs }} accessibilityLiveRegion="polite">
          <StatusChip status={b.status} />
          <Text variant="title1" testID="tracking-headline">
            {headline}
          </Text>
          <Text tone="secondary">{sub}</Text>
        </View>
        {late ? (
          <Card variant="outline" style={{ flexDirection: 'row', gap: t.spacing.md }} testID="late-banner">
            <Icon icon={Clock} color={t.colors.tone.warning.text} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{name} a du retard</Text>
              <Text variant="callout" tone="secondary">
                Plus de 30 min de retard sur l'heure annoncée : vous pouvez annuler sans frais, ou l'appeler.
              </Text>
            </View>
          </Card>
        ) : null}
        <ArtisanContact booking={b} subtitle={b.artisan?.phoneMasked ? `Appel via numéro relais · ${b.artisan.phoneMasked}` : null} />
        {b.completionCode ? <CompletionCode code={b.completionCode} compact /> : null}
      </View>
      <CancelSheet booking={b} visible={cancelOpen} onClose={() => setCancelOpen(false)} />
    </Screen>
  );
}
