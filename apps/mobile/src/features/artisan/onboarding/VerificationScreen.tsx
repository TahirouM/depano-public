import { RULES, type ArtisanPrivateProfileDto, type KycChecklistDto } from '@depano/schemas';
import {
  Button,
  Card,
  Divider,
  formatDateLong,
  Screen,
  SkeletonList,
  Text,
  useTheme,
} from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { BadgeCheck, CircleAlert, CircleCheck, Clock, Hourglass } from 'lucide-react-native';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { useSwitchRole } from '@/components/RoleSwitch';
import { useArtisanProfile } from '../queries';
import { addBusinessDays } from '../format';
import { CHECKLIST_LABELS } from './kyc';
import { latestDocs } from './DocumentsStep';

/** Statut « en vérification » : checklist, délai annoncé (48 h ouvrées), validé / suspendu. */
export function VerificationScreen() {
  const profile = useArtisanProfile();
  return (
    <>
      <Stack.Screen
        options={{ title: 'Vérification', headerBackVisible: false, gestureEnabled: false }}
      />
      <QueryView
        query={profile}
        loading={
          <Screen>
            <SkeletonList count={4} variant="row" />
          </Screen>
        }
      >
        {(p) =>
          p.status === 'draft' || p.status === 'rejected' ? (
            <Redirect href="/pro/onboarding" />
          ) : (
            <Content p={p} />
          )
        }
      </QueryView>
    </>
  );
}

function Content({ p }: { p: ArtisanPrivateProfileDto }) {
  const t = useTheme();
  const switchRole = useSwitchRole();
  const docs = latestDocs(p.documents);
  const approved = p.status === 'approved';
  const suspended = p.status === 'suspended';
  const eta = p.submittedAt
    ? addBusinessDays(new Date(p.submittedAt), Math.ceil(RULES.kycReviewBusinessHours / 24))
    : null;

  const itemState = (k: keyof KycChecklistDto): 'ok' | 'review' => {
    if (approved) return 'ok';
    if (k === 'identity') return docs.identity?.status === 'approved' ? 'ok' : 'review';
    if (k === 'insurance')
      return docs.insurance_decennale?.status === 'approved' ||
        docs.insurance_rc_pro?.status === 'approved'
        ? 'ok'
        : 'review';
    if (k === 'siret') return 'review';
    return 'ok';
  };

  return (
    <Screen
      footer={
        approved ? (
          <Button
            label="Aller à mon espace artisan"
            size="lg"
            fullWidth
            haptic="success"
            onPress={() => router.replace('/pro/accueil')}
            testID="verification-home"
          />
        ) : (
          <View style={{ gap: t.spacing.sm }}>
            <Button
              label="Prévisualiser mon profil"
              size="lg"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/pro/profil/apercu')}
            />
            <Button
              label="Revenir à l'espace client"
              variant="ghost"
              fullWidth
              onPress={() => void switchRole('client')}
            />
          </View>
        )
      }
    >
      <View style={{ gap: t.spacing.lg }} testID="verification-screen">
        <View style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.lg }}>
          {approved ? (
            <BadgeCheck size={64} color={t.colors.tone.success.solid} />
          ) : suspended ? (
            <CircleAlert size={64} color={t.colors.tone.danger.solid} />
          ) : (
            <Hourglass size={64} color={t.colors.text.brand} />
          )}
          <Text variant="title1" align="center" accessibilityRole="header">
            {approved
              ? 'Profil validé !'
              : suspended
                ? 'Compte suspendu'
                : 'Dossier en vérification'}
          </Text>
          <Text tone="secondary" align="center">
            {approved
              ? 'Votre profil est visible des clients. Activez « Disponible pour urgences » depuis l’accueil pour recevoir des demandes.'
              : suspended
                ? 'Vous pouvez consulter votre historique et vos revenus. Contactez le support pour en savoir plus.'
                : `Un conseiller vérifie votre dossier sous ${RULES.kycReviewBusinessHours} h ouvrées. Vous recevrez une notification dès la validation.`}
          </Text>
        </View>

        {!approved && !suspended && eta ? (
          <Card
            variant="brand"
            style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}
          >
            <Clock size={22} color={t.colors.text.brand} />
            <Text style={{ flex: 1 }}>
              Réponse attendue au plus tard <Text variant="bodyStrong">{formatDateLong(eta)}</Text>.
            </Text>
          </Card>
        ) : null}

        <Card padding="none">
          {(Object.keys(CHECKLIST_LABELS) as (keyof KycChecklistDto)[]).map((k, i) => {
            const s = p.checklist[k] ? itemState(k) : 'review';
            return (
              <View key={k}>
                {i > 0 ? <Divider inset={56} /> : null}
                <View
                  accessible
                  accessibilityLabel={`${CHECKLIST_LABELS[k]} : ${s === 'ok' ? (approved ? 'validé' : 'complet') : 'en cours de vérification'}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.spacing.lg,
                    paddingHorizontal: t.spacing.lg,
                    minHeight: 56,
                  }}
                >
                  {s === 'ok' ? (
                    <CircleCheck size={24} color={t.colors.tone.success.solid} />
                  ) : (
                    <Hourglass size={24} color={t.colors.tone.warning.solid} />
                  )}
                  <Text style={{ flex: 1 }}>{CHECKLIST_LABELS[k]}</Text>
                  <Text variant="caption" tone={s === 'ok' ? 'success' : 'warning'}>
                    {s === 'ok' ? (approved ? 'Validé' : 'Complet') : 'En vérification'}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      </View>
    </Screen>
  );
}
