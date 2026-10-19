import { formatEuros, type BookingDetailDto } from '@depano/schemas';
import {
  Button,
  Card,
  SegmentedControl,
  Screen,
  SectionHeader,
  SkeletonList,
  Switch,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Send } from 'lucide-react-native';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { errorMessage } from '@/lib/api';
import { useIsOnline } from '@/lib/online';
import { useBookingLive } from '@/lib/realtime/hooks';
import { useDraft } from '@/stores/drafts';
import { PhotoGrid } from '../components/PhotoGrid';
import { VoiceNote } from '../components/VoiceNote';
import { artisanMk, type ReportPhoto, type ReportVars } from '../mutations';

interface ReportDraft {
  feasible?: boolean;
  materials?: string;
  notes?: string;
  followUpNeeded?: boolean;
  travelOnly?: boolean;
  before?: ReportPhoto[];
  after?: ReportPhoto[];
  voice?: (ReportPhoto & { durationMs?: number }) | null;
}

/** Compte rendu d'intervention (brouillon persisté, envoi rejouable hors ligne). */
export function ReportScreen({ id, travelOnly }: { id: string; travelOnly?: boolean }) {
  const q = useBookingLive(id);
  return (
    <>
      <Stack.Screen options={{ title: travelOnly ? 'Déplacement seulement' : 'Compte rendu' }} />
      <QueryView query={q} loading={<SkeletonList count={4} variant="row" />}>
        {(b) => <ReportForm b={b} initialTravelOnly={!!travelOnly} />}
      </QueryView>
    </>
  );
}

function ReportForm({ b, initialTravelOnly }: { b: BookingDetailDto; initialTravelOnly: boolean }) {
  const t = useTheme();
  const toast = useToast();
  const online = useIsOnline();
  const [draft, patch, reset] = useDraft<ReportDraft>(`report:${b.id}`);
  const submit = useMutation<BookingDetailDto, Error, ReportVars>({
    mutationKey: artisanMk.report,
  });

  const canTravelOnly = b.status === 'arrived';
  const travelOnly = canTravelOnly && (draft.travelOnly ?? initialTravelOnly);
  const feasible = travelOnly ? false : (draft.feasible ?? true);
  const before = draft.before ?? [];
  const after = draft.after ?? [];
  const allowed = b.status === 'in_progress' || canTravelOnly;
  const travelFee = b.price.travelFeeCents;

  const send = () => {
    const vars: ReportVars = {
      bookingId: b.id,
      feasible,
      materials: draft.materials?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      followUpNeeded: !!draft.followUpNeeded,
      travelOnly,
      before,
      after,
      voice: draft.voice
        ? { uri: draft.voice.uri, contentType: draft.voice.contentType, fileId: draft.voice.fileId }
        : null,
    };
    submit.mutate(vars, {
      onSuccess: (nb) => {
        reset();
        toast.success('Compte rendu envoyé. Demandez le code de fin au client.');
        router.replace({ pathname: '/pro/interventions/[id]/code', params: { id: nb.id } });
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
    if (!online) {
      toast.show({
        message: 'Vous êtes hors ligne. Le compte rendu partira au retour du réseau.',
        type: 'info',
      });
      router.back();
    }
  };

  if (!allowed) {
    return (
      <Screen
        inTabs
        footer={
          <Button
            label="Retour"
            size="lg"
            variant="secondary"
            fullWidth
            onPress={() => router.back()}
          />
        }
      >
        <Card style={{ gap: t.spacing.sm }}>
          <Text variant="title2">Compte rendu indisponible</Text>
          <Text tone="secondary">
            {b.status === 'awaiting_code' || b.status === 'closed'
              ? 'Le compte rendu a déjà été envoyé.'
              : 'Le compte rendu se fait une fois le devis validé et les travaux terminés.'}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      inTabs
      footer={
        <View style={{ gap: t.spacing.xs }}>
          <Button
            label={travelOnly ? 'Clôturer en déplacement seulement' : 'Envoyer et demander le code'}
            icon={Send}
            size="lg"
            fullWidth
            haptic="success"
            loading={submit.isPending && online}
            onPress={send}
            testID="report-send"
          />
          <Text variant="caption" tone="secondary" align="center">
            Brouillon enregistré automatiquement
          </Text>
        </View>
      }
      testID="report-screen"
    >
      <View style={{ gap: t.spacing.lg }}>
        {canTravelOnly ? (
          <Switch
            label="Déplacement seulement"
            description={`Aucun travail réalisé : seuls les frais de déplacement (${formatEuros(travelFee)}) seront facturés, sans commission.`}
            value={travelOnly}
            onValueChange={(v) => patch({ travelOnly: v })}
            testID="report-travel-only"
          />
        ) : null}

        {!travelOnly ? (
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Intervention réalisable ?</Text>
            <SegmentedControl
              options={[
                { value: 'yes', label: 'Oui, réalisée' },
                { value: 'no', label: 'Non' },
              ]}
              value={feasible ? 'yes' : 'no'}
              onChange={(v) => patch({ feasible: v === 'yes' })}
              accessibilityLabel="Intervention réalisable"
            />
          </View>
        ) : null}

        {!travelOnly ? (
          <TextField
            label="Matériel utilisé"
            value={draft.materials ?? ''}
            onChangeText={(v) => patch({ materials: v })}
            placeholder="Ex. joint fibre 20/27, flexible inox 50 cm"
            multiline
            maxLength={2000}
            testID="report-materials"
          />
        ) : null}

        <SectionHeader title="Photos" />
        <PhotoGrid
          label="Avant"
          photos={before}
          onChange={(p) => patch({ before: p })}
          purpose="report_before"
          testID="photos-before"
        />
        {!travelOnly ? (
          <PhotoGrid
            label="Après"
            photos={after}
            onChange={(p) => patch({ after: p })}
            purpose="report_after"
            testID="photos-after"
          />
        ) : null}

        <SectionHeader title="Note" />
        <VoiceNote value={draft.voice} onChange={(v) => patch({ voice: v })} />
        <TextField
          label={travelOnly ? 'Pourquoi aucun travail ?' : 'Note pour le client'}
          value={draft.notes ?? ''}
          onChangeText={(v) => patch({ notes: v })}
          placeholder={
            travelOnly
              ? 'Ex. client absent, devis refusé…'
              : 'Ex. fuite réparée, surveiller le joint dans 1 mois'
          }
          helper="Astuce : touchez le micro du clavier pour dicter."
          multiline
          maxLength={4000}
          testID="report-notes"
        />

        {!travelOnly ? (
          <Switch
            label="Retour nécessaire"
            description="Une seconde intervention est à prévoir (pièce à commander, séchage…)."
            value={!!draft.followUpNeeded}
            onValueChange={(v) => patch({ followUpNeeded: v })}
            testID="report-follow-up"
          />
        ) : null}
      </View>
    </Screen>
  );
}
