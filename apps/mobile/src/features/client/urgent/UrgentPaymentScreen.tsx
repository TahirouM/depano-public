import { DOMAIN_LABELS, RULES, formatEuros } from '@depano/schemas';
import { Button, Card, Divider, Icon, ProgressHeader, Screen, Skeleton, Switch, Text, haptic, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { CircleAlert, CreditCard, Lock, MapPin, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useIsSignedIn } from '@/lib/query/hooks';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { DRAFT_KEYS, useDraft } from '@/stores/drafts';
import { choicePoint, toBookingAddress } from '../components/AddressChooser';
import { BookingPriceSummary } from '../components/BookingPriceSummary';
import { Checkbox } from '../components/Checkbox';
import { addressLabel, uploadDraftMedia, type UrgentFlowDraft } from '../drafts';
import { PHASE_LABEL, useCheckout } from '../payment/useCheckout';
import { useAddresses, useEstimate, usePaymentMethods } from '../queries';

export const WAIVER_LABEL = 'Je demande une intervention immédiate et renonce à mon droit de rétractation';

/** Urgence 4 sur 4 : fourchette, frais d'urgence, garantie, total TTC, renonciation, paiement. */
export function UrgentPaymentScreen() {
  const t = useTheme();
  const [draft, patch, reset] = useDraft<UrgentFlowDraft>(DRAFT_KEYS.urgent);
  const signedIn = useIsSignedIn();
  const requireAuth = useRequireAuth();
  const saved = useAddresses();
  const cards = usePaymentMethods();
  const point = choicePoint(draft, saved.data);
  const withGuarantee = !!draft.withGuarantee;
  const estimate = useEstimate(
    draft.domain && point ? { domain: draft.domain, serviceId: draft.serviceId, lat: point.lat, lng: point.lng, urgent: true, withGuarantee } : null,
  );
  const checkout = useCheckout();
  const [waiverError, setWaiverError] = useState<string | null>(null);

  if (!draft.domain || !draft.problemReason) return <Redirect href="/urgence/domaine" />;
  if (!point) return <Redirect href="/urgence/adresse" />;

  const card = cards.data?.find((c) => c.isDefault) ?? cards.data?.[0];

  const pay = async () => {
    if (!draft.waivesWithdrawal) {
      setWaiverError('Cochez cette case pour une intervention immédiate.');
      return;
    }
    if (!requireAuth('Créez votre compte pour payer — cela prend 30 secondes.')) return;
    // Retour tactile au moment où la demande part réellement (pas sur un appui refusé par la validation).
    // La confirmation du paiement déclenche ensuite son propre « success » dans useCheckout.
    haptic('medium');
    const booking = await checkout.run(async () => ({
      kind: 'urgent',
      domain: draft.domain!,
      serviceId: draft.serviceId,
      ...toBookingAddress(draft, saved.data),
      problemReason: draft.problemReason!.trim(),
      problemDescription: draft.problemDescription?.trim() || undefined,
      problemFileIds: await uploadDraftMedia(draft),
      priceOnRequest: false,
      withGuarantee,
      waivesWithdrawal: true,
      paymentMethodId: card?.id,
    }));
    if (booking) {
      reset();
      router.replace({ pathname: '/urgence/[bookingId]/recherche', params: { bookingId: booking.id } });
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="callout" tone="secondary" align="center">
            Vous ne payez qu'à la fin, quand vous donnez le code.
          </Text>
          <Button
            variant="urgent"
            size="lg"
            fullWidth
            icon={Lock}
            label={checkout.busy ? PHASE_LABEL[checkout.phase] : signedIn ? 'Valider et trouver un artisan' : 'Continuer vers le paiement'}
            loading={checkout.busy}
            disabled={!estimate.data}
            onPress={() => void pay()}
            testID="urgent-pay"
          />
        </View>
      }
    >
      <Stack.Screen options={{ title: 'Urgence · Paiement', headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={4} total={4} title="Prix et paiement" subtitle="Prix connu avant engagement, devis sur place obligatoire avant travaux." />

        <Card variant="flat" padding="md" style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={Wrench} size={20} color={t.colors.text.secondary} />
            <Text style={{ flex: 1 }}>
              {DOMAIN_LABELS[draft.domain]} · {draft.problemReason}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={MapPin} size={20} color={t.colors.text.secondary} />
            <Text style={{ flex: 1 }}>
              {addressLabel(draft.address ?? saved.data?.find((a) => a.id === draft.addressId))}
            </Text>
          </View>
        </Card>

        <Card style={{ gap: t.spacing.md }}>
          {estimate.data ? (
            <BookingPriceSummary
              price={estimate.data.price}
              showRange
              baseLabel={draft.serviceId ? 'Intervention (prix de base)' : 'Diagnostic et intervention'}
            />
          ) : estimate.isError ? (
            <Text tone="danger">Prix indisponible. Vérifiez votre connexion et réessayez.</Text>
          ) : (
            <View style={{ gap: t.spacing.sm }}>
              <Skeleton width="70%" />
              <Skeleton width="50%" />
              <Skeleton width="60%" height={24} />
            </View>
          )}
        </Card>

        <Switch
          label={`Garantie annulation (${formatEuros(RULES.cancellationGuaranteeCents)})`}
          description="Annulez sans frais à tout moment, même une fois l'artisan en route."
          value={withGuarantee}
          onValueChange={(v) => patch({ withGuarantee: v })}
          testID="guarantee-toggle"
        />

        <Divider />

        <Checkbox
          testID="waiver-checkbox"
          checked={!!draft.waivesWithdrawal}
          onChange={(v) => {
            patch({ waivesWithdrawal: v });
            if (v) setWaiverError(null);
          }}
          label={WAIVER_LABEL}
          description="Obligatoire pour une réparation urgente à domicile (Code de la consommation). Un devis détaillé vous sera soumis avant tout travail."
          error={waiverError}
        />

        <Card variant="brand" padding="md" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
          <Icon icon={CreditCard} color={t.colors.text.brand} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{card ? `${card.brand.toUpperCase()} •••• ${card.last4}` : 'Carte bancaire, Apple Pay ou Google Pay'}</Text>
            <Text variant="callout" tone="secondary">
              Votre carte n'est débitée qu'à la fin. Rien n'est prélevé maintenant.
            </Text>
          </View>
        </Card>

        {checkout.error ? (
          <Card variant="outline" style={{ gap: t.spacing.sm }} testID="payment-error">
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Icon icon={CircleAlert} color={t.colors.tone.danger.text} />
              <Text variant="bodyStrong" tone="danger">
                Paiement refusé
              </Text>
            </View>
            <Text tone="secondary">{checkout.error}</Text>
            <Text variant="callout" tone="secondary">
              Ce n'est pas de votre faute. Réessayez dans un instant ou utilisez une autre carte.
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
