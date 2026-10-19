import { formatEuros } from '@depano/schemas';
import { Button, ProgressHeader, Screen, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { View } from 'react-native';
import { ProblemDetails } from '../components/ProblemDetails';
import { ReasonPicker } from '../components/ReasonPicker';
import { SCHEDULED_TYPE_LABELS, useRdv } from './useRdv';

/** RDV 2 sur 4 : prestation (liste) + détail facultatif (texte, photo). */
export function RdvMotifScreen({ artisanId }: { artisanId: string }) {
  const t = useTheme();
  const rdv = useRdv(artisanId);
  const { draft, patch } = rdv;
  if (!draft.scheduledType) return <Redirect href={{ pathname: '/rdv/type', params: { artisanId } }} />;
  const list = rdv.ofKind(draft.scheduledType);
  const ok = !!draft.problemReason?.trim();

  return (
    <Screen
      footer={
        <Button label="Choisir un créneau" size="lg" fullWidth disabled={!ok} onPress={() => router.push({ pathname: '/rdv/creneau', params: { artisanId } })} testID="rdv-motif-next" />
      }
    >
      <Stack.Screen options={{ title: `Rendez-vous · ${SCHEDULED_TYPE_LABELS[draft.scheduledType].title}`, headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={2} total={4} title="Quelle prestation ?" subtitle="Tarifs de l'artisan, hors déplacement." />
        <ReasonPicker
          services={list}
          loading={!list}
          value={draft}
          onChange={(v) => patch({ ...v, scheduledAt: v.serviceId !== draft.serviceId ? undefined : draft.scheduledAt })}
          priceFor={(s) => {
            const p = list?.find((x) => x.id === s.id)?.priceCents;
            return p != null ? formatEuros(p) : null;
          }}
        />
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
