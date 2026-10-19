import { DISPUTE_REASON_LABELS, DISPUTE_REASONS, type BookingDetailDto, type DisputeReason } from '@depano/schemas';
import { BottomSheet, Button, Icon, Text, TextField, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Circle, CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';

const HINTS: Record<DisputeReason, string> = {
  never_came: "L'artisan ne s'est jamais présenté.",
  travel_only: 'Il est venu mais n’a rien fait.',
  poor_quality: 'Le travail ne règle pas le problème.',
  overcharged: 'Le montant ne correspond pas au devis.',
  other: 'Expliquez-nous en quelques mots.',
};

/** « Que s'est-il passé ? » : ouvre un litige, la capture du paiement est gelée. */
export function DisputeSheet({ booking, visible, onClose }: { booking: BookingDetailDto; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const m = useMutation({
    mutationFn: () => api.bookings.dispute(booking.id, { reason: reason!, description: description.trim() || undefined }),
    onSuccess: (b) => {
      qc.setQueryData(qk.bookings.detail(b.id), b);
      void qc.invalidateQueries({ queryKey: qk.bookings.lists });
      toast.success('Signalement envoyé. Le paiement est gelé, notre équipe vous répond sous 72 h.');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const needsText = reason === 'other' && !description.trim();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Que s'est-il passé ?"
      description="Rien ne sera débité tant que notre équipe n'a pas tranché (sous 72 h)."
      testID="dispute-sheet"
      footer={
        <Button
          variant="danger"
          size="lg"
          fullWidth
          label="Signaler le problème"
          disabled={!reason || needsText}
          loading={m.isPending}
          onPress={() => m.mutate()}
          testID="confirm-dispute"
        />
      }
    >
      <View style={{ gap: t.spacing.sm }} accessibilityRole="radiogroup">
        {DISPUTE_REASONS.map((r) => {
          const selected = reason === r;
          return (
            <Pressable
              key={r}
              testID={`dispute-${r}`}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${DISPUTE_REASON_LABELS[r]}. ${HINTS[r]}`}
              style={{
                flexDirection: 'row',
                gap: t.spacing.md,
                alignItems: 'center',
                minHeight: 56,
                padding: t.spacing.md,
                borderRadius: t.radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? t.colors.tone.danger.solid : t.colors.border.subtle,
              }}
            >
              <Icon icon={selected ? CircleCheck : Circle} color={selected ? t.colors.tone.danger.text : t.colors.text.secondary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{DISPUTE_REASON_LABELS[r]}</Text>
                <Text variant="callout" tone="secondary">
                  {HINTS[r]}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <TextField
          label={reason === 'other' ? 'Décrivez le problème' : 'Précisions (facultatif)'}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={4000}
        />
      </View>
    </BottomSheet>
  );
}
