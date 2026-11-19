import {
  formatEuros,
  RULES,
  type ArtisanPrivateProfileDto,
  type PromotionDto,
} from '@depano/schemas';
import {
  Badge,
  Button,
  Card,
  ConfirmSheet,
  formatDateLong,
  haptic,
  Screen,
  SkeletonList,
  Text,
  useTheme,
  useToast,
  type LucideIcon,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { BadgeCheck, Eye, RefreshCw, Rocket, TrendingUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { sessionToSheet } from '@/features/client/payment/useCheckout';
import { usePaymentSheet } from '@/features/client/payment/usePaymentSheet';
import { api, ApiError, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useArtisanProfile } from '../queries';

/** « 29,90 € / 30 jours ». */
export function promotionPriceLabel(p: Pick<PromotionDto, 'priceCents' | 'periodDays'>) {
  return `${formatEuros(p.priceCents)} / ${p.periodDays} jours`;
}

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: TrendingUp,
    title: 'En tête des résultats',
    text: 'Votre profil apparaît en premier dans les recherches des clients de votre zone.',
  },
  {
    icon: BadgeCheck,
    title: 'Badge « Mis en avant »',
    text: 'Votre fiche se distingue dans la liste et sur la carte.',
  },
  {
    icon: Eye,
    title: 'Plus de demandes',
    text: 'Plus de visibilité, plus de rendez-vous : vous gardez la main sur vos disponibilités.',
  },
];

/** « Promouvoir mon compte » : abonnement mensuel de mise en avant (renouvellement automatique, résiliable). */
export function PromotionScreen() {
  const profile = useArtisanProfile();
  return (
    <>
      <Stack.Screen options={{ title: 'Promouvoir mon compte' }} />
      <QueryView query={profile} loading={<SkeletonList count={3} />}>
        {(p) => <Promotion p={p} />}
      </QueryView>
    </>
  );
}

function Promotion({ p }: { p: ArtisanPrivateProfileDto }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const sheet = usePaymentSheet();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const promo: PromotionDto = p.promotion ?? {
    active: false,
    until: null,
    autoRenew: false,
    priceCents: RULES.promotion.priceCents,
    periodDays: RULES.promotion.periodDays,
  };
  const approved = p.status === 'approved';

  const setPromotion = (promotion: PromotionDto) => {
    qc.setQueryData<ArtisanPrivateProfileDto>(qk.artisan.profile, (old) =>
      old ? { ...old, promotion } : old,
    );
    void qc.invalidateQueries({ queryKey: qk.artisan.profile });
  };

  const subscribe = useMutation({
    mutationFn: async (): Promise<PromotionDto | null> => {
      const res = await api.artisan.subscribePromotion();
      if (!res.payment) return res.promotion;
      const r = await sheet.present(sessionToSheet(res.payment));
      if (r.status === 'cancelled') return null;
      if (r.status === 'failed') throw new Error(r.message);
      // Paiement validé : l'abonnement est activé côté serveur (webhook), on relit son état.
      return api.artisan.promotion();
    },
    onSuccess: (promotion) => {
      if (!promotion) return;
      setPromotion(promotion);
      haptic('success');
      toast.success(
        promotion.active
          ? 'Votre profil est mis en avant.'
          : 'Paiement validé : la mise en avant s’active dans quelques instants.',
      );
    },
    onError: (e) => {
      haptic('error');
      // Erreur de la feuille de paiement : message du prestataire ; erreur API : message serveur.
      toast.error(
        e instanceof Error && !(e instanceof ApiError)
          ? e.message
          : errorMessage(e, 'Le paiement a échoué. Réessayez.'),
      );
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.artisan.cancelPromotion(),
    onSuccess: (promotion) => {
      setPromotion(promotion);
      setConfirmCancel(false);
      toast.show({
        message: promotion.until
          ? `Abonnement résilié. Mise en avant active jusqu’au ${formatDateLong(promotion.until)}.`
          : 'Abonnement résilié.',
        type: 'info',
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  let footer = null;
  if (!promo.active || !promo.autoRenew)
    footer = (
      <View style={{ gap: t.spacing.xs }}>
        <Button
          label={
            promo.active
              ? 'Réactiver le renouvellement'
              : `Souscrire · ${promotionPriceLabel(promo)}`
          }
          icon={promo.active ? RefreshCw : Rocket}
          size="lg"
          fullWidth
          disabled={!approved}
          loading={subscribe.isPending}
          onPress={() => subscribe.mutate()}
          testID="promotion-subscribe"
        />
        {!approved ? (
          <Text variant="caption" tone="secondary" align="center">
            Disponible après la validation de votre compte.
          </Text>
        ) : null}
      </View>
    );
  else
    footer = (
      <Button
        label="Résilier"
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => setConfirmCancel(true)}
        testID="promotion-cancel"
      />
    );

  return (
    <Screen inTabs footer={footer} testID="promotion-screen">
      <View style={{ gap: t.spacing.xl }}>
        <Card variant="brand" style={{ gap: t.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <Rocket size={40} color={t.colors.text.brand} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title2" accessibilityRole="header">
                Promouvoir mon compte
              </Text>
              <Text variant="callout" tone="secondary">
                Profitez d’un avantage marketing en promouvant votre profil sur la plateforme.
              </Text>
            </View>
          </View>
          {promo.active ? (
            <View style={{ gap: t.spacing.xs }} testID="promotion-active">
              <Badge label="Mis en avant" tone="success" />
              <Text variant="bodyStrong">
                Actif jusqu’au {promo.until ? formatDateLong(promo.until) : '…'}
              </Text>
              <Text variant="callout" tone="secondary">
                {promo.autoRenew
                  ? `Renouvellement automatique à cette date (${promotionPriceLabel(promo)}).`
                  : 'Abonnement résilié : pas de renouvellement, la mise en avant s’arrête à cette date.'}
              </Text>
            </View>
          ) : (
            <Text variant="title1" testID="promotion-price">
              {promotionPriceLabel(promo)}
            </Text>
          )}
        </Card>

        <View style={{ gap: t.spacing.lg }}>
          {BENEFITS.map((x) => (
            <View key={x.title} style={{ flexDirection: 'row', gap: t.spacing.md }}>
              <x.icon size={24} color={t.colors.text.brand} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{x.title}</Text>
                <Text tone="secondary">{x.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Card variant="flat" style={{ gap: t.spacing.xs }}>
          <Text variant="label">Abonnement mensuel</Text>
          <Text variant="callout" tone="secondary">
            {promotionPriceLabel(promo)}, renouvelé automatiquement à chaque période. Résiliable à
            tout moment : la mise en avant reste active jusqu’à la fin de la période payée, sans
            remboursement au prorata.
          </Text>
        </Card>
      </View>
      <ConfirmSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        tone="danger"
        title="Résilier la mise en avant ?"
        message={`Votre profil reste mis en avant jusqu’au ${promo.until ? formatDateLong(promo.until) : 'terme de la période'}, puis l’abonnement s’arrête.`}
        confirmLabel="Résilier"
        cancelLabel="Garder l'abonnement"
      />
    </Screen>
  );
}
