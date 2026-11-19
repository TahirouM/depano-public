import { formatEuros, type BookingDetailDto } from '@depano/schemas';
import {
  Button,
  Card,
  SegmentedControl,
  Screen,
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
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { errorMessage } from '@/lib/api';
import { useIsOnline } from '@/lib/online';
import { useBookingLive } from '@/lib/realtime/hooks';
import { useDraft } from '@/stores/drafts';
import { PhotoGrid } from '../components/PhotoGrid';
import { VoiceNote } from '../components/VoiceNote';
import { artisanMk, type ReportPhoto, type ReportVars } from '../mutations';
import { ArtisanNoteField } from './ArtisanNoteField';
import { FormRow } from './FormRow';
import { NotFeasibleForm } from './NotFeasibleForm';
import { canDeclareNotFeasible, interventionNature } from './status';

interface ReportDraft {
  materials?: string;
  notes?: string;
  followUpNeeded?: boolean;
  travelOnly?: boolean;
  before?: ReportPhoto[];
  after?: ReportPhoto[];
  voice?: (ReportPhoto & { durationMs?: number }) | null;
}

/**
 * Compte rendu d'intervention (maquette « Mes interventions ») : questionnaire disponible seulement
 * intervention en cours (brouillon persisté, envoi rejouable hors ligne). « Intervention réalisable ? Non »
 * bascule sur le formulaire « non réalisable » (frais de déplacement, report ou annulation).
 */
export function ReportScreen({
  id,
  travelOnly,
  notFeasible,
}: {
  id: string;
  travelOnly?: boolean;
  notFeasible?: boolean;
}) {
  const q = useBookingLive(id);
  return (
    <>
      <Stack.Screen
        options={{
          title: travelOnly
            ? 'Déplacement seulement'
            : notFeasible
              ? 'Non réalisable'
              : 'Compte rendu',
        }}
      />
      <QueryView query={q} loading={<SkeletonList count={4} variant="row" />}>
        {(b) => (
          <Questionnaire b={b} initialTravelOnly={!!travelOnly} initialFeasible={!notFeasible} />
        )}
      </QueryView>
    </>
  );
}

function Questionnaire({
  b,
  initialTravelOnly,
  initialFeasible,
}: {
  b: BookingDetailDto;
  initialTravelOnly: boolean;
  initialFeasible: boolean;
}) {
  const [feasible, setFeasible] = useState(initialFeasible || !canDeclareNotFeasible(b));
  const header = (
    <QuestionnaireHeader
      b={b}
      feasible={feasible}
      onFeasible={canDeclareNotFeasible(b) ? setFeasible : undefined}
    />
  );
  if (!feasible) return <NotFeasibleForm b={b} header={header} />;
  return <ReportForm b={b} initialTravelOnly={initialTravelOnly} header={header} />;
}

/** « Nature de l'intervention » + « Intervention réalisable ? Oui / Non ». */
function QuestionnaireHeader({
  b,
  feasible,
  onFeasible,
}: {
  b: BookingDetailDto;
  feasible: boolean;
  onFeasible?: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.md }}>
      <FormRow label="Nature de l’intervention" value={interventionNature(b)} />
      {onFeasible ? (
        <Card style={{ gap: t.spacing.sm }}>
          <Text variant="bodyStrong" nativeID="feasible-label">
            Intervention réalisable ?
          </Text>
          <SegmentedControl
            options={[
              { value: 'yes', label: 'Oui' },
              { value: 'no', label: 'Non' },
            ]}
            value={feasible ? 'yes' : 'no'}
            onChange={(v) => onFeasible(v === 'yes')}
            accessibilityLabel="Intervention réalisable"
          />
        </Card>
      ) : null}
    </View>
  );
}

function ReportForm({
  b,
  initialTravelOnly,
  header,
}: {
  b: BookingDetailDto;
  initialTravelOnly: boolean;
  header: ReactNode;
}) {
  const t = useTheme();
  const toast = useToast();
  const online = useIsOnline();
  const [draft, patch, reset] = useDraft<ReportDraft>(`report:${b.id}`);
  const submit = useMutation<BookingDetailDto, Error, ReportVars>({
    mutationKey: artisanMk.report,
  });

  const canTravelOnly = b.status === 'arrived';
  const travelOnly = canTravelOnly && (draft.travelOnly ?? initialTravelOnly);
  const before = draft.before ?? [];
  const after = draft.after ?? [];
  const allowed = b.status === 'in_progress' || canTravelOnly;
  const travelFee = b.price.travelFeeCents;
  const tarif = b.quote?.status === 'accepted' ? b.quote.totalCents : b.totalCents;

  const send = () => {
    const vars: ReportVars = {
      bookingId: b.id,
      feasible: !travelOnly,
      materials: draft.materials?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      followUpNeeded: !travelOnly && !!draft.followUpNeeded,
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
        <Card style={{ gap: t.spacing.sm }} testID="report-unavailable">
          <Text variant="title2">Compte rendu indisponible</Text>
          <Text tone="secondary">
            {b.status === 'awaiting_code' || b.status === 'closed'
              ? 'Le compte rendu a déjà été envoyé.'
              : 'Le compte rendu se remplit quand l’intervention est en cours : une fois sur place, envoyez le devis ; le client le valide, puis vous démarrez les travaux.'}
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
            label={travelOnly ? 'Clôturer en déplacement seulement' : 'Terminer l’intervention'}
            icon={Send}
            size="lg"
            fullWidth
            haptic="success"
            loading={submit.isPending && online}
            onPress={send}
            testID="report-send"
          />
          <Text variant="caption" tone="secondary" align="center">
            Brouillon enregistré automatiquement · le client saisira ensuite son code de fin
          </Text>
        </View>
      }
      testID="report-screen"
    >
      <View style={{ gap: t.spacing.md }}>
        {travelOnly ? (
          <FormRow label="Nature de l’intervention" value={interventionNature(b)} />
        ) : (
          header
        )}

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
          <FormRow
            label="Tarif d’intervention"
            value={formatEuros(tarif)}
            onPress={() =>
              router.push({ pathname: '/pro/interventions/[id]/devis', params: { id: b.id } })
            }
            hint="Affiche le devis accepté par le client"
            testID="report-price"
          />
        ) : null}

        {!travelOnly ? (
          <Card>
            <TextField
              label="Ajouter du matériel"
              value={draft.materials ?? ''}
              onChangeText={(v) => patch({ materials: v })}
              placeholder="Ex. joint fibre 20/27, flexible inox 50 cm"
              multiline
              maxLength={2000}
              testID="report-materials"
            />
          </Card>
        ) : null}

        <Card>
          <ArtisanNoteField bookingId={b.id} note={b.artisanNote} />
        </Card>

        <Card style={{ gap: t.spacing.md }}>
          <TextField
            label={travelOnly ? 'Pourquoi aucun travail ?' : 'Détail du compte rendu'}
            value={draft.notes ?? ''}
            onChangeText={(v) => patch({ notes: v })}
            placeholder={
              travelOnly
                ? 'Ex. devis refusé par le client'
                : 'Ex. fuite réparée, surveiller le joint dans 1 mois'
            }
            helper="Transmis au client avec la facture. Astuce : touchez le micro du clavier pour dicter."
            multiline
            maxLength={4000}
            testID="report-notes"
          />
          <VoiceNote value={draft.voice} onChange={(v) => patch({ voice: v })} />
        </Card>

        <Card style={{ gap: t.spacing.lg }}>
          <Text variant="bodyStrong">Ajouter des photos</Text>
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
        </Card>

        {!travelOnly ? (
          <Card style={{ gap: t.spacing.sm }}>
            <Text variant="bodyStrong">Retour après intervention ?</Text>
            <SegmentedControl
              options={[
                { value: 'yes', label: 'Oui' },
                { value: 'no', label: 'Non' },
              ]}
              value={draft.followUpNeeded ? 'yes' : 'no'}
              onChange={(v) => patch({ followUpNeeded: v === 'yes' })}
              accessibilityLabel="Retour après intervention nécessaire"
            />
            {draft.followUpNeeded ? (
              <Text variant="caption" tone="secondary">
                Une seconde intervention est à prévoir (pièce à commander, séchage…).
              </Text>
            ) : null}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
