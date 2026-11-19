import { formatEuros } from '@depano/schemas';
import { Button, ProgressHeader, Screen, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { View } from 'react-native';
import { ProblemDetails } from '../components/ProblemDetails';
import { ReasonPicker } from '../components/ReasonPicker';
import { RdvArtisanBanner } from './RdvArtisanBanner';
import { PRICE_ON_REQUEST_LABEL, SCHEDULED_TYPE_LABELS, useRdv } from './useRdv';

/**
 * RDV 2 sur 4 : motif avec le prix de l'artisan pour chaque prestation, ou « Autre… » (besoin
 * hors catalogue, prix sur devis : la demande part sans paiement) + détail facultatif (texte, photo).
 */
export function RdvMotifScreen({ artisanId }: { artisanId: string }) {
  const t = useTheme();
  const rdv = useRdv(artisanId);
  const { draft, patch } = rdv;
  if (!draft.scheduledType) return <Redirect href={{ pathname: '/rdv/type', params: { artisanId } }} />;
  const list = rdv.ofKind(draft.scheduledType);
  const ok = !!draft.problemReason?.trim();
  const travel = rdv.artisan.data?.travelFeeCents;
  const what = draft.scheduledType === 'maintenance' ? "Motif de l'entretien" : 'Motif du dépannage';

  return (
    <Screen
      footer={
        <Button label="Choisir un créneau" size="lg" fullWidth disabled={!ok} onPress={() => router.push({ pathname: '/rdv/creneau', params: { artisanId } })} testID="rdv-motif-next" />
      }
    >
      <Stack.Screen options={{ title: `Rendez-vous · ${SCHEDULED_TYPE_LABELS[draft.scheduledType].title}`, headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader
          step={2}
          total={4}
          title={what}
          subtitle={`Précisez bien le motif : l'artisan anticipe mieux son intervention. Tarifs de l'artisan${travel != null ? `, déplacement en plus (${formatEuros(travel)})` : ', hors déplacement'}.`}
        />
        <RdvArtisanBanner artisan={rdv.artisan} />
        <ReasonPicker
          services={list}
          loading={!list}
          value={draft}
          onChange={(v) => patch({ ...v, scheduledAt: v.serviceId !== draft.serviceId ? undefined : draft.scheduledAt })}
          priceFor={(s) => {
            const p = list?.find((x) => x.id === s.id)?.priceCents;
            return p != null ? formatEuros(p) : null;
          }}
          other={{
            label: 'Autre…',
            subtitle: PRICE_ON_REQUEST_LABEL,
            fieldLabel: 'Décrivez votre besoin',
            placeholder: 'Ex. : installer un ballon d’eau chaude de 200 L',
            helper: "L'artisan étudie votre demande et vous propose un prix ; vous restez libre de l'accepter.",
            maxLength: 500,
            multiline: true,
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
