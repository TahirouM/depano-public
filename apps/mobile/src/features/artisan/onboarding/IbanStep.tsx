import { Badge, Button, Card, ProgressHeader, Screen, Text, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Landmark, Lock } from 'lucide-react-native';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useArtisanProfile } from '../queries';
import { KYC_STEPS, KYC_TOTAL, nextStepHref, stepIndex } from './kyc';

/** Étape 5 : IBAN et vérification d'identité via le formulaire du prestataire de paiement (Stripe Connect). */
export function IbanStep() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useArtisanProfile();
  const p = profile.data;
  const linked = !!p?.payoutsEnabled;
  const complete = !!p && KYC_STEPS.every((s) => s.done(p.checklist));

  const open = useMutation({
    mutationFn: async () => {
      const { url } = await api.artisan.payoutOnboardingLink();
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      }).catch(() => undefined);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.artisan.profile }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = useMutation({
    mutationFn: api.artisan.submit,
    onSuccess: (pr) => {
      qc.setQueryData(qk.artisan.profile, pr);
      void qc.invalidateQueries({ queryKey: qk.me });
      router.replace('/pro/onboarding/verification');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Screen
      footer={
        linked ? (
          complete ? (
            <Button
              label="Envoyer mon dossier"
              size="lg"
              fullWidth
              haptic="success"
              loading={submit.isPending}
              onPress={() => submit.mutate()}
              testID="kyc-submit"
            />
          ) : (
            <Button
              label="Compléter les étapes restantes"
              size="lg"
              fullWidth
              onPress={() => router.push(nextStepHref(p?.checklist, 'iban'))}
            />
          )
        ) : (
          <Button
            label="Renseigner mon IBAN"
            icon={Landmark}
            size="lg"
            fullWidth
            loading={open.isPending}
            onPress={() => open.mutate()}
            testID="iban-open"
          />
        )
      }
    >
      <Stack.Screen options={{ title: 'Compte bancaire' }} />
      <View style={{ gap: t.spacing.lg }}>
        <ProgressHeader
          step={stepIndex('iban')}
          total={KYC_TOTAL}
          title="Où recevoir vos paiements ?"
          subtitle="Vous êtes payé à chaque code de fin validé, sans relance."
        />
        <Card
          variant={linked ? 'brand' : 'surface'}
          style={{ gap: t.spacing.sm }}
          testID="iban-status"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Landmark size={22} color={t.colors.text.brand} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              Virements
            </Text>
            <Badge
              label={linked ? 'Activés' : 'À configurer'}
              tone={linked ? 'success' : 'warning'}
            />
          </View>
          <Text variant="callout" tone="secondary">
            {linked
              ? 'Votre compte bancaire est enregistré. Les virements arrivent sous 2 à 3 jours ouvrés après chaque intervention.'
              : "Le formulaire sécurisé de notre prestataire de paiement s'ouvre : IBAN, puis vérification d'identité (obligation légale)."}
          </Text>
          {linked ? (
            <Button
              label="Modifier mon IBAN"
              variant="ghost"
              size="sm"
              onPress={() => open.mutate()}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
        </Card>
        <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <Lock size={22} color={t.colors.text.secondary} />
          <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
            DEPANO ne voit jamais votre IBAN complet. La commission est prélevée automatiquement,
            jamais sur les frais de déplacement seuls.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
