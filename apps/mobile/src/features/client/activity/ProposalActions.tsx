import { formatEuros, type BookingSummaryDto } from '@depano/schemas';
import { Button, ConfirmSheet, Text, formatDateTime, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { PHASE_LABEL, usePayBooking } from '../payment/useCheckout';
import { proposalOf } from './bookingState';

/**
 * Proposition de l'artisan (prix d'une demande « Autre », nouveau rendez-vous) : « Accepter et confirmer »
 * valide l'empreinte bancaire (session de paiement → feuille de paiement → confirmation), « Refuser » annule.
 */
export function ProposalActions({ booking: b, compact }: { booking: BookingSummaryDto; compact?: boolean }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const payer = usePayBooking();
  const [refuseOpen, setRefuseOpen] = useState(false);
  const kind = proposalOf(b);

  const { error: payError, clearError } = payer;
  useEffect(() => {
    if (!payError) return;
    toast.error(payError);
    clearError();
  }, [payError]); // eslint-disable-line react-hooks/exhaustive-deps -- un toast par erreur

  const refuse = useMutation({
    mutationFn: () => api.bookings.cancel(b.id, { reason: kind === 'reschedule' ? 'Nouveau rendez-vous refusé' : 'Prix proposé refusé' }),
    onSuccess: (updated) => {
      qc.setQueryData(qk.bookings.detail(b.id), updated);
      void qc.invalidateQueries({ queryKey: qk.bookings.lists });
      void qc.invalidateQueries({ queryKey: qk.badges });
      setRefuseOpen(false);
      toast.success('Proposition refusée. Rien ne vous a été prélevé.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!kind) return null;
  const accept = async () => {
    const done = await payer.pay(b.id);
    if (done) toast.success(kind === 'reschedule' ? 'Nouveau rendez-vous confirmé.' : 'Prix accepté : rendez-vous confirmé.');
  };

  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text variant={compact ? 'bodyStrong' : 'title2'} testID="proposal-title">
        {kind === 'price'
          ? `Prix proposé : ${formatEuros(b.totalCents)}`
          : `Nouveau rendez-vous proposé${b.scheduledAt ? ` le ${formatDateTime(b.scheduledAt)}` : ''}`}
      </Text>
      <Text variant="callout" tone="secondary">
        {kind === 'price'
          ? 'Déplacement compris. En acceptant, vous validez une empreinte bancaire : rien n’est débité avant la fin.'
          : `Total : ${formatEuros(b.totalCents)}. En acceptant, vous validez une empreinte bancaire : rien n’est débité avant la fin.`}
      </Text>
      {b.requestExpiresAt ? (
        <Text variant="callout" tone="warning" testID="proposal-deadline">
          Répondez avant le {formatDateTime(b.requestExpiresAt)}, sinon la proposition expire.
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Button
          label={payer.busy ? PHASE_LABEL[payer.phase] : 'Accepter et confirmer'}
          loading={payer.busy}
          onPress={() => void accept()}
          haptic="success"
          style={{ flex: 2 }}
          testID="proposal-accept"
        />
        <Button variant="secondary" label="Refuser" disabled={payer.busy} onPress={() => setRefuseOpen(true)} style={{ flex: 1 }} testID="proposal-refuse" />
      </View>
      <ConfirmSheet
        visible={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        onConfirm={() => refuse.mutate()}
        loading={refuse.isPending}
        tone="danger"
        title={kind === 'price' ? 'Refuser le prix proposé ?' : 'Refuser ce nouveau rendez-vous ?'}
        message="La demande sera annulée sans frais. Vous pourrez reprendre rendez-vous quand vous voulez."
        confirmLabel="Refuser"
      />
    </View>
  );
}
