import { DISPUTE_REASON_LABELS, formatEuros } from '@depano/schemas';
import { Button, Card, EmptyState, ErrorState, Icon, Screen, Skeleton, SuccessCheck, Text, useTheme } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { Hourglass, Scale } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { errorMessage } from '@/lib/api';
import { useBookingLive } from '@/lib/realtime/hooks';
import { CompletionCode } from '../components/CompletionCode';
import { DisputeSheet } from '../components/DisputeSheet';

/** Fin d'intervention : code à 4 chiffres en grand, « Que s'est-il passé ? », clôture en direct. */
export function EndScreen({ id }: { id: string }) {
  return (
    <AuthGate title="Fin d'intervention" message="Connectez-vous pour afficher votre code de fin.">
      <EndInner id={id} />
    </AuthGate>
  );
}

function EndInner({ id }: { id: string }) {
  const t = useTheme();
  const live = useBookingLive(id);
  const b = live.data;
  const [disputeOpen, setDisputeOpen] = useState(false);
  // Clôture survenue en direct sur cet écran (et non déjà clôturée à l'ouverture) : seule cette
  // transition déclenche le retour haptique « succès », porté par SuccessCheck. Calculé pendant le rendu
  // (statut précédent mémorisé en state) pour que la coche soit montée avec la bonne valeur.
  const [prevStatus, setPrevStatus] = useState(b?.status);
  const [justClosed, setJustClosed] = useState(false);
  if (b?.status !== prevStatus) {
    if (prevStatus && prevStatus !== 'closed' && b?.status === 'closed') setJustClosed(true);
    setPrevStatus(b?.status);
  }

  const header = <Stack.Screen options={{ title: "Fin d'intervention" }} />;
  if (!b) {
    return (
      <Screen inTabs>
        {header}
        {live.isError ? <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refetch()} /> : <Skeleton height={220} radius={t.radius.md} />}
      </Screen>
    );
  }

  if (b.status === 'closed') {
    return (
      <Screen
        inTabs
        footer={
          b.canReview ? (
            <Button size="lg" fullWidth label="Noter l'artisan" onPress={() => router.replace({ pathname: '/activite/[id]/notation', params: { id } })} testID="end-review" />
          ) : (
            <Button size="lg" fullWidth label="Voir l'intervention" onPress={() => router.dismissTo({ pathname: '/activite/[id]', params: { id } })} />
          )
        }
      >
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl, gap: t.spacing.md }} testID="end-closed">
          <SuccessCheck haptic={justClosed} accessibilityLabel="Intervention terminée" />
          <Text variant="title2" align="center">
            Intervention terminée
          </Text>
          <Text tone="secondary" align="center">
            {`Merci ! ${b.capturedCents != null ? `${formatEuros(b.capturedCents)} débités.` : 'Le paiement est en cours.'} Votre facture est disponible dans l'intervention.`}
          </Text>
        </View>
      </Screen>
    );
  }

  if (b.status === 'disputed') {
    return (
      <Screen inTabs footer={<Button size="lg" fullWidth label="Voir l'intervention" onPress={() => router.dismissTo({ pathname: '/activite/[id]', params: { id } })} />}>
        {header}
        <EmptyState
          fill
          icon={Scale}
          title="Signalement enregistré"
          message={`${b.dispute ? DISPUTE_REASON_LABELS[b.dispute.reason] + '. ' : ''}Le paiement est gelé. Notre équipe tranche sous 72 h et vous tient informé.`}
        />
      </Screen>
    );
  }

  const canDispute = b.allowedTransitions.includes('disputed');
  return (
    <Screen
      inTabs
      footer={
        canDispute ? (
          <Button variant="secondary" size="lg" fullWidth label="Que s'est-il passé ?" onPress={() => setDisputeOpen(true)} testID="end-dispute" />
        ) : undefined
      }
    >
      {header}
      <View style={{ gap: t.spacing.xl }} testID="end">
        <View style={{ gap: t.spacing.xs }}>
          <Text variant="title1">{b.status === 'awaiting_code' ? 'Tout est en ordre ?' : 'Votre code de fin'}</Text>
          <Text tone="secondary">
            {b.status === 'awaiting_code'
              ? "L'artisan a terminé. Si le travail vous convient, donnez-lui ce code : il le saisit et le paiement est déclenché."
              : "Gardez ce code pour la fin de l'intervention. Ne le donnez qu'une fois le travail terminé."}
          </Text>
        </View>
        {b.completionCode ? (
          <CompletionCode code={b.completionCode} attemptsLeft={b.completionAttemptsLeft} />
        ) : (
          <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <Icon icon={Hourglass} color={t.colors.text.secondary} />
            <Text style={{ flex: 1 }} tone="secondary">
              Le code apparaîtra dès qu'un artisan sera assigné.
            </Text>
          </Card>
        )}
        <Text variant="callout" tone="secondary">
          Sans code ni signalement, le paiement est déclenché automatiquement 24 h après la fin des travaux.
        </Text>
      </View>
      <DisputeSheet booking={b} visible={disputeOpen} onClose={() => setDisputeOpen(false)} />
    </Screen>
  );
}
