import { formatEuros, type BookingDetailDto } from '@depano/schemas';
import { BottomSheet, Button, Card, Chip, Icon, Text, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Info } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';

const REASONS = ['Problème résolu', "J'ai trouvé une autre solution", 'Délai trop long', 'Erreur dans la demande', 'Autre raison'];

export interface CancelSheetProps {
  booking: BookingDetailDto;
  visible: boolean;
  onClose: () => void;
  onCancelled?: (b: BookingDetailDto) => void;
}

/** Annulation client : aperçu des frais (gratuit / frais de déplacement), motif, confirmation. */
export function CancelSheet({ booking: b, visible, onClose, onCancelled }: CancelSheetProps) {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const cancel = useMutation({
    mutationFn: () => api.bookings.cancel(b.id, { reason: reason ?? undefined }),
    onSuccess: (updated) => {
      qc.setQueryData(qk.bookings.detail(b.id), updated);
      void qc.invalidateQueries({ queryKey: qk.bookings.lists });
      void qc.invalidateQueries({ queryKey: qk.badges });
      toast.success(updated.cancellationFeeCents > 0 ? `Intervention annulée. ${formatEuros(updated.cancellationFeeCents)} de frais de déplacement.` : 'Intervention annulée sans frais.');
      onClose();
      onCancelled?.(updated);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const free = b.cancellationIsFree;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Annuler l'intervention ?"
      testID="cancel-sheet"
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            label={free ? 'Annuler sans frais' : `Annuler et payer ${formatEuros(b.cancellationFeeCents)}`}
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
            testID="confirm-cancel"
          />
          <Button variant="ghost" fullWidth label="Garder l'intervention" onPress={onClose} />
        </View>
      }
    >
      <View style={{ gap: t.spacing.lg }}>
        <Card variant={free ? 'flat' : 'outline'} padding="md" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' }}>
          <Icon icon={free ? CircleCheck : Info} color={free ? t.colors.tone.success.text : t.colors.tone.warning.text} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{free ? 'Annulation gratuite' : `Frais de déplacement : ${formatEuros(b.cancellationFeeCents)}`}</Text>
            <Text variant="callout" tone="secondary">
              {free
                ? b.withGuarantee
                  ? 'Votre garantie annulation couvre cette annulation.'
                  : "Votre empreinte bancaire est libérée, rien n'est prélevé."
                : "Moins de 2 h avant l'intervention (ou artisan en route), seuls les frais de déplacement sont dus. Rien d'autre n'est prélevé."}
            </Text>
          </View>
        </Card>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Pourquoi annulez-vous ? (facultatif)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {REASONS.map((r) => (
              <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(reason === r ? null : r)} />
            ))}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
