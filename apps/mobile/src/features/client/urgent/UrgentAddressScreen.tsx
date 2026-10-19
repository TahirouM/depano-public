import { Button, Card, Icon, ProgressHeader, Screen, Skeleton, Text, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { MapPinOff, Users } from 'lucide-react-native';
import { useCallback } from 'react';
import { View } from 'react-native';
import { DRAFT_KEYS, useDraft } from '@/stores/drafts';
import { AddressChooser, choicePoint, type AddressChoice } from '../components/AddressChooser';
import type { UrgentFlowDraft } from '../drafts';
import { useAddresses, useEstimate } from '../queries';

/** Urgence 3 sur 4 : adresse pré-remplie (autocomplétion), étage, digicode, accès ; état hors zone. */
export function UrgentAddressScreen() {
  const t = useTheme();
  const [draft, patch] = useDraft<UrgentFlowDraft>(DRAFT_KEYS.urgent);
  const saved = useAddresses();
  const point = choicePoint(draft, saved.data);
  const estimate = useEstimate(point && draft.domain ? { domain: draft.domain, serviceId: draft.serviceId, lat: point.lat, lng: point.lng, urgent: true } : null);
  const onChange = useCallback((v: AddressChoice) => patch({ addressId: v.addressId, address: v.address }), [patch]);

  if (!draft.domain || !draft.problemReason) return <Redirect href="/urgence/domaine" />;
  const outOfZone = estimate.data?.inZone === false;
  const ok = !!point && !!estimate.data && !outOfZone;

  return (
    <Screen
      footer={
        <Button label="Voir le prix" size="lg" fullWidth disabled={!ok} loading={!!point && estimate.isFetching && !estimate.data} onPress={() => router.push('/urgence/paiement')} testID="urgent-address-next" />
      }
    >
      <Stack.Screen options={{ title: 'Urgence · Adresse', headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={3} total={4} title="Où faut-il intervenir ?" subtitle="L'adresse exacte n'est transmise qu'à l'artisan qui accepte." />
        <AddressChooser value={draft} onChange={onChange} />

        {point && estimate.isPending ? <Skeleton height={64} radius={t.radius.md} /> : null}
        {outOfZone ? (
          <Card variant="outline" style={{ gap: t.spacing.sm }} testID="out-of-zone">
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Icon icon={MapPinOff} color={t.colors.tone.warning.text} />
              <Text variant="bodyStrong">Hors zone pour l'instant</Text>
            </View>
            <Text tone="secondary">
              DEPANO intervient à Marseille et alentours. Nous arrivons bientôt près de chez vous : vérifiez l'adresse ou choisissez-en une autre.
            </Text>
          </Card>
        ) : estimate.data && estimate.data.inZone ? (
          <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <Icon icon={Users} color={t.colors.text.brand} />
            <Text variant="callout" style={{ flex: 1 }}>
              {estimate.data.availableArtisans > 0
                ? `${estimate.data.availableArtisans} artisan${estimate.data.availableArtisans > 1 ? 's' : ''} disponible${estimate.data.availableArtisans > 1 ? 's' : ''} près de chez vous${estimate.data.etaMinutes != null ? ` · arrivée estimée ${estimate.data.etaMinutes} min` : ''}.`
                : 'Peu d’artisans disponibles en ce moment : nous élargirons la recherche automatiquement.'}
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
