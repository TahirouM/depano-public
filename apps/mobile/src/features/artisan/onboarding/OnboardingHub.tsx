import { ApiError } from '@depano/schemas';
import {
  Badge,
  Button,
  Card,
  Divider,
  ListItem,
  Screen,
  SkeletonList,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, Stack } from 'expo-router';
import { Circle, CircleAlert, CircleCheck, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useArtisanProfile } from '../queries';
import { KYC_STEPS, KYC_TOTAL, nextStepHref } from './kyc';

/**
 * Point d'entrée du KYC : progression par étape (checklist serveur), reprise là où
 * l'artisan s'est arrêté, envoi du dossier quand tout est complet, état « refusé ».
 */
export function OnboardingHub() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useArtisanProfile();
  const created = useRef(false);

  // Pas encore de profil (rôle choisi hors ligne, course avec me.setActiveRole) : on crée le brouillon.
  useEffect(() => {
    const e = profile.error;
    if (!created.current && e instanceof ApiError && e.status === 403) {
      created.current = true;
      api.me
        .setActiveRole({ role: 'artisan' })
        .then((me) => {
          qc.setQueryData(qk.me, me);
          void profile.refetch();
        })
        .catch(() => undefined);
    }
  }, [profile.error, profile, qc]);

  const submit = useMutation({
    mutationFn: api.artisan.submit,
    onSuccess: (p) => {
      qc.setQueryData(qk.artisan.profile, p);
      void qc.invalidateQueries({ queryKey: qk.me });
      router.replace('/pro/onboarding/verification');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const p = profile.data;
  if (p && (p.status === 'pending_review' || p.status === 'approved' || p.status === 'suspended')) {
    return <Redirect href="/pro/onboarding/verification" />;
  }
  const done = p ? KYC_STEPS.filter((s) => s.done(p.checklist)).length : 0;
  const complete = done === KYC_TOTAL;

  return (
    <Screen
      footer={
        p ? (
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
              label={done === 0 ? 'Commencer' : 'Continuer'}
              size="lg"
              fullWidth
              onPress={() => router.push(nextStepHref(p.checklist))}
              testID="kyc-continue"
            />
          )
        ) : null
      }
    >
      <Stack.Screen options={{ title: 'Devenir artisan' }} />
      <QueryView query={profile} loading={<SkeletonList count={5} variant="row" />}>
        {(pr) => (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ gap: t.spacing.xs }}>
              <Text variant="title1" accessibilityRole="header">
                Recevez des clients près de chez vous
              </Text>
              <Text tone="secondary">
                5 étapes, environ 10 minutes. Vous pouvez vous arrêter à tout moment : votre saisie
                est enregistrée.
              </Text>
            </View>

            {pr.status === 'rejected' ? (
              <Card
                variant="outline"
                style={{ gap: t.spacing.sm, borderColor: t.colors.tone.danger.solid }}
                testID="kyc-rejected"
              >
                <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
                  <CircleAlert size={22} color={t.colors.tone.danger.text} />
                  <Text variant="bodyStrong" tone="danger">
                    Dossier refusé
                  </Text>
                </View>
                <Text>
                  {pr.rejectionReason ?? "Un ou plusieurs justificatifs n'ont pas pu être validés."}
                </Text>
                <Text variant="callout" tone="secondary">
                  Corrigez les éléments concernés puis renvoyez votre dossier.
                </Text>
              </Card>
            ) : null}

            <View style={{ gap: t.spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text variant="label" tone="secondary">
                  {done} étape{done > 1 ? 's' : ''} sur {KYC_TOTAL} terminée{done > 1 ? 's' : ''}
                </Text>
                {complete ? <Badge label="Prêt à envoyer" tone="success" /> : null}
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: KYC_TOTAL, now: done }}
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: t.colors.background.subtle,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${(done / KYC_TOTAL) * 100}%`,
                    height: 8,
                    backgroundColor: t.colors.tone.success.solid,
                  }}
                />
              </View>
            </View>

            <Card padding="none">
              {KYC_STEPS.map((s, i) => {
                const ok = s.done(pr.checklist);
                return (
                  <View key={s.key}>
                    {i > 0 ? <Divider inset={56} /> : null}
                    <ListItem
                      title={`${i + 1}. ${s.title}`}
                      subtitle={ok ? 'Terminé' : 'À compléter'}
                      left={
                        ok ? (
                          <CircleCheck size={24} color={t.colors.tone.success.solid} />
                        ) : (
                          <Circle size={24} color={t.colors.text.secondary} />
                        )
                      }
                      onPress={() => router.push(s.href)}
                      accessibilityLabel={`Étape ${i + 1} : ${s.title}, ${ok ? 'terminée' : 'à compléter'}`}
                      testID={`kyc-step-${s.key}`}
                    />
                  </View>
                );
              })}
            </Card>

            <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md }}>
              <ShieldCheck size={24} color={t.colors.text.brand} />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                Vos documents sont stockés de façon sécurisée et ne sont jamais montrés aux clients.
                Un conseiller valide votre profil sous 48 h ouvrées.
              </Text>
            </Card>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
