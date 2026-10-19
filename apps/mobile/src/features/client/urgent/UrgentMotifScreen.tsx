import { DOMAIN_LABELS } from '@depano/schemas';
import { Button, ProgressHeader, Screen, Text, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { View } from 'react-native';
import { useDomains } from '@/lib/query/hooks';
import { DRAFT_KEYS, useDraft } from '@/stores/drafts';
import { ProblemDetails } from '../components/ProblemDetails';
import { ReasonPicker } from '../components/ReasonPicker';
import type { UrgentFlowDraft } from '../drafts';

/** Urgence 2 sur 4 : motif prédéfini + précisions (texte, photos, vocal). */
export function UrgentMotifScreen() {
  const t = useTheme();
  const [draft, patch] = useDraft<UrgentFlowDraft>(DRAFT_KEYS.urgent);
  const domains = useDomains();
  if (!draft.domain) return <Redirect href="/urgence/domaine" />;
  const services = domains.data?.find((d) => d.code === draft.domain)?.services.filter((s) => s.urgentEligible);
  const ok = !!draft.problemReason?.trim();

  return (
    <Screen
      footer={
        <Button
          label="Continuer"
          size="lg"
          fullWidth
          disabled={!ok}
          onPress={() => router.push('/urgence/adresse')}
          accessibilityHint={ok ? undefined : 'Choisissez d’abord un motif'}
          testID="urgent-motif-next"
        />
      }
    >
      <Stack.Screen options={{ title: `Urgence · ${DOMAIN_LABELS[draft.domain]}`, headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={2} total={4} title="Que se passe-t-il ?" />
        <ReasonPicker
          services={services}
          loading={domains.isPending}
          value={draft}
          onChange={(v) => patch(v)}
        />
        {domains.isError ? (
          <Text tone="secondary" variant="callout">
            Motifs indisponibles hors ligne : choisissez « Autre problème ».
          </Text>
        ) : null}
        <ProblemDetails
          value={{ description: draft.problemDescription, photoUris: draft.problemPhotoUris, photoTypes: draft.photoTypes, voiceUri: draft.voiceUri }}
          onChange={(v) =>
            patch({
              ...(v.description !== undefined ? { problemDescription: v.description } : null),
              ...(v.photoUris ? { problemPhotoUris: v.photoUris, photoTypes: v.photoTypes, problemFileIds: [] } : null),
              ...(v.voiceUri !== undefined ? { voiceUri: v.voiceUri, problemFileIds: [] } : null),
            })
          }
        />
      </View>
    </Screen>
  );
}
