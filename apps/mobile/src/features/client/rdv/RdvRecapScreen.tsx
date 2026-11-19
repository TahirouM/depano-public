import { DOMAIN_LABELS, RULES, computePrice, formatEuros } from '@depano/schemas';
import { Button, Card, Divider, Icon, PriceRow, ProgressHeader, Screen, Switch, Text, formatDateTime, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { CalendarClock, CircleAlert, CreditCard, Info, MapPinOff, MessageSquareText, Wrench } from 'lucide-react-native';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useIsSignedIn } from '@/lib/query/hooks';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { AddressChooser, choicePoint, toBookingAddress, type AddressChoice } from '../components/AddressChooser';
import { BookingPriceSummary } from '../components/BookingPriceSummary';
import { uploadDraftMedia } from '../drafts';
import { PHASE_LABEL, useCheckout } from '../payment/useCheckout';
import { useAddresses, useArtisan, usePaymentMethods, useReferral } from '../queries';
import { RdvArtisanBanner } from './RdvArtisanBanner';
import { PRICE_ON_REQUEST_LABEL, SCHEDULED_TYPE_LABELS, useRdv } from './useRdv';

/**
 * RDV 4 sur 4 : adresse (pré-remplie), récapitulatif, conditions d'annulation, carte.
 * La demande part à l'artisan, qui l'accepte (statut `requested` → `accepted`).
 * Besoin « Autre… » : pas de prix ni de paiement, « Envoyer la demande » ; l'artisan proposera un prix.
 */
export function RdvRecapScreen({ artisanId }: { artisanId: string }) {
  const t = useTheme();
  const rdv = useRdv(artisanId);
  const { draft, patch, reset, artisan } = rdv;
  const signedIn = useIsSignedIn();
  const requireAuth = useRequireAuth();
  const saved = useAddresses();
  const cards = usePaymentMethods();
  const checkout = useCheckout();
  const referral = useReferral();
  const point = choicePoint(draft, saved.data);
  // Distance artisan ↔ adresse (calculée par l'API) pour vérifier sa zone d'intervention.
  const near = useArtisan(point ? artisanId : undefined, point);
  const onAddress = useCallback((v: AddressChoice) => patch({ addressId: v.addressId, address: v.address }), [patch]);

  if (!draft.scheduledAt || !draft.problemReason || !draft.scheduledType) return <Redirect href={{ pathname: '/rdv/type', params: { artisanId } }} />;

  const a = artisan.data;
  const domain = rdv.domain;
  const onRequest = rdv.priceOnRequest;
  const discountCents = referral.data?.nextDiscountCents ?? 0;
  const price =
    a && !onRequest
      ? computePrice({ basePriceCents: rdv.basePriceCents, travelFeeCents: a.travelFeeCents, urgent: false, withGuarantee: !!draft.withGuarantee, discountCents })
      : null;
  const outOfArea = near.data?.distanceKm != null && near.data.distanceKm > near.data.radiusKm;
  const daysAhead = (new Date(draft.scheduledAt).getTime() - Date.now()) / 86_400_000;
  const deferred = daysAhead > RULES.authorizationMaxDaysAhead;
  const card = cards.data?.find((c) => c.isDefault) ?? cards.data?.[0];
  const slotPassed = new Date(draft.scheduledAt).getTime() < Date.now();

  const confirm = async () => {
    if (!requireAuth('Créez votre compte pour réserver — cela prend 30 secondes.')) return;
    const need = draft.problemReason!.trim();
    const details = draft.problemDescription?.trim();
    const booking = await checkout.run(async () => ({
      kind: 'scheduled',
      domain: domain!,
      artisanId,
      serviceId: onRequest ? undefined : draft.serviceId,
      scheduledType: draft.scheduledType,
      scheduledAt: draft.scheduledAt,
      ...toBookingAddress(draft, saved.data),
      // « Autre… » : le besoin saisi devient la description que l'artisan chiffre.
      problemReason: onRequest ? 'Autre' : need,
      problemDescription: onRequest ? [need, details].filter(Boolean).join('\n\n') : details || undefined,
      problemFileIds: await uploadDraftMedia(draft),
      priceOnRequest: onRequest,
      withGuarantee: !onRequest && !!draft.withGuarantee,
      waivesWithdrawal: false,
      paymentMethodId: onRequest ? undefined : card?.id,
    }));
    if (booking) {
      reset();
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: '/rdv/confirmation', params: { bookingId: booking.id } });
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="callout" tone="secondary" align="center">
            {onRequest
              ? "Rien n'est payé maintenant : l'artisan vous proposera un prix."
              : "L'artisan doit accepter votre demande. Votre carte n'est débitée qu'à la fin."}
          </Text>
          <Button
            size="lg"
            fullWidth
            label={
              checkout.busy
                ? PHASE_LABEL[checkout.phase]
                : onRequest
                  ? 'Envoyer la demande'
                  : signedIn
                    ? 'Envoyer la demande de rendez-vous'
                    : 'Continuer vers le paiement'
            }
            loading={checkout.busy}
            disabled={(!price && !onRequest) || !a || !point || outOfArea || slotPassed || !domain}
            onPress={() => void confirm()}
            testID="rdv-confirm"
          />
        </View>
      }
    >
      <Stack.Screen options={{ title: 'Rendez-vous · Récapitulatif', headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={4} total={4} title={onRequest ? 'Vérifiez et envoyez votre demande' : 'Vérifiez et confirmez'} />
        <RdvArtisanBanner artisan={artisan} />

        <Card variant="flat" padding="md" style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={CalendarClock} size={20} color={t.colors.text.secondary} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {formatDateTime(draft.scheduledAt)}
            </Text>
            <Button variant="ghost" size="sm" label="Modifier" onPress={() => router.back()} />
          </View>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={Wrench} size={20} color={t.colors.text.secondary} />
            <Text style={{ flex: 1 }}>
              {SCHEDULED_TYPE_LABELS[draft.scheduledType].title}
              {domain ? ` · ${DOMAIN_LABELS[domain]}` : ''}
              {onRequest ? ' · Autre besoin' : ` · ${draft.problemReason}`}
            </Text>
          </View>
          {onRequest ? (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Icon icon={MessageSquareText} size={20} color={t.colors.text.secondary} />
              <Text tone="secondary" style={{ flex: 1 }}>
                {draft.problemReason}
              </Text>
            </View>
          ) : null}
        </Card>
        {slotPassed ? (
          <Text tone="danger">Ce créneau est passé : choisissez-en un autre.</Text>
        ) : null}

        <View style={{ gap: t.spacing.md }}>
          <Text variant="title2" accessibilityRole="header">
            Lieu d'intervention
          </Text>
          <AddressChooser value={draft} onChange={onAddress} />
          {outOfArea ? (
            <Card variant="outline" style={{ flexDirection: 'row', gap: t.spacing.md }} testID="rdv-out-of-area">
              <Icon icon={MapPinOff} color={t.colors.tone.warning.text} />
              <Text style={{ flex: 1 }} tone="secondary">
                Cette adresse est hors de la zone de {a?.displayName} ({a?.radiusKm} km). Choisissez une autre adresse ou un autre artisan.
              </Text>
            </Card>
          ) : null}
        </View>

        {onRequest ? (
          <Card style={{ gap: t.spacing.md }} testID="rdv-price-on-request">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.spacing.md }}>
              <Text style={{ flex: 1 }}>Prestation</Text>
              <Text variant="bodyStrong">{PRICE_ON_REQUEST_LABEL}</Text>
            </View>
            {a ? <PriceRow label="Déplacement" cents={a.travelFeeCents} /> : null}
            <Divider />
            <Text variant="callout" tone="secondary">
              L'artisan va étudier votre demande et vous proposer un prix ; vous pourrez l'accepter ou non. Votre carte ne sera demandée qu'à
              l'acceptation du prix.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={{ gap: t.spacing.md }}>
              {price ? <BookingPriceSummary price={price} baseLabel={rdv.selectedService?.name ?? 'Intervention'} /> : <Text tone="secondary">Calcul du prix…</Text>}
              <Text variant="callout" tone="secondary">
                Le devis détaillé de l'artisan sur place reste à valider dans l'app avant tout travail.
              </Text>
            </Card>

            <Switch
              label={`Garantie annulation (${formatEuros(RULES.cancellationGuaranteeCents)})`}
              description="Annulez sans frais jusqu'au dernier moment."
              value={!!draft.withGuarantee}
              onValueChange={(v) => patch({ withGuarantee: v })}
            />
          </>
        )}

        <Card variant="outline" style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={Info} size={20} color={t.colors.text.brand} />
            <Text variant="bodyStrong">Conditions d'annulation</Text>
          </View>
          <Text variant="callout" tone="secondary">
            Annulation gratuite pendant {RULES.cancellation.freeWithinHoursAfterBooking} h après la prise de rendez-vous (et tant que l'artisan n'a pas confirmé). Ensuite, seuls les frais de déplacement ({a ? formatEuros(a.travelFeeCents) : '—'}) sont dus, sauf garantie annulation. Si l'artisan a plus de {RULES.cancellation.lateArtisanMinutes} min de retard, vous annulez sans frais.
          </Text>
          <Divider />
          <Text variant="callout" tone="secondary">
            Droit de rétractation : vous disposez de 14 jours à compter de la réservation. En confirmant un rendez-vous fixé avant la fin de ce délai, vous demandez que l'intervention ait lieu à cette date ; si vous vous rétractez après le début des travaux, seule la part déjà réalisée est due.
          </Text>
        </Card>

        {onRequest ? null : (
          <Card variant="brand" padding="md" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <Icon icon={CreditCard} color={t.colors.text.brand} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{card ? `${card.brand.toUpperCase()} •••• ${card.last4}` : 'Carte bancaire, Apple Pay ou Google Pay'}</Text>
              <Text variant="callout" tone="secondary">
                {deferred
                  ? "Votre carte est enregistrée maintenant ; l'empreinte bancaire sera faite 24 h avant le rendez-vous."
                  : "Empreinte bancaire du montant total : rien n'est débité avant le code de fin."}
              </Text>
            </View>
          </Card>
        )}

        {checkout.error ? (
          <Card variant="outline" style={{ gap: t.spacing.sm }} testID="payment-error">
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Icon icon={CircleAlert} color={t.colors.tone.danger.text} />
              <Text variant="bodyStrong" tone="danger">
                Réservation non confirmée
              </Text>
            </View>
            <Text tone="secondary">{checkout.error}</Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
