import type { PaymentMethodDto } from '@depano/schemas';
import { Badge, Button, Card, ConfirmSheet, Divider, IconButton, ListItem, Screen, SkeletonList, Text, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { CreditCard, Lock, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { optimistic } from '@/lib/query/optimistic';
import { usePaymentSheet } from '../payment/usePaymentSheet';
import { usePaymentMethods } from '../queries';

const BRAND: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', cb: 'CB' };

/** Moyens de paiement : cartes enregistrées (Stripe), ajout via SetupIntent, suppression. */
export function PaymentMethodsScreen() {
  return (
    <AuthGate title="Moyens de paiement" message="Connectez-vous pour gérer vos cartes.">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const sheet = usePaymentSheet();
  const q = usePaymentMethods();
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<PaymentMethodDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.me.deletePaymentMethod(id),
    ...optimistic<PaymentMethodDto[], string>(qc, {
      queryKey: () => qk.paymentMethods,
      update: (old, id) => old?.filter((c) => c.id !== id),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  });

  const add = async () => {
    setAdding(true);
    try {
      const si = await api.me.setupIntent();
      const r = await sheet.present({ provider: si.provider, clientSecret: si.clientSecret, setup: true, customerId: si.customerId, ephemeralKey: si.ephemeralKey });
      if (r.status === 'succeeded') {
        toast.success('Carte enregistrée.');
        await qc.invalidateQueries({ queryKey: qk.paymentMethods });
      } else if (r.status === 'failed') toast.error(r.message);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Screen inTabs footer={<Button size="lg" fullWidth icon={Plus} label="Ajouter une carte" loading={adding} onPress={() => void add()} testID="add-card" />}>
      <Stack.Screen options={{ title: 'Moyens de paiement' }} />
      <View style={{ gap: t.spacing.lg }}>
        <QueryView
          query={q}
          loading={<SkeletonList count={2} variant="row" />}
          isEmpty={(d) => d.length === 0}
          empty={{ icon: CreditCard, title: 'Aucune carte enregistrée', message: 'Ajoutez une carte pour réserver en un geste. Apple Pay et Google Pay sont aussi proposés au paiement.' }}
        >
          {(cards) => (
            <Card padding="none" testID="card-list">
              {cards.map((c, i) => (
                <View key={c.id}>
                  {i > 0 ? <Divider inset={56} /> : null}
                  <ListItem
                    icon={CreditCard}
                    title={`${BRAND[c.brand] ?? c.brand.toUpperCase()} •••• ${c.last4}`}
                    subtitle={`Expire fin ${String(c.expMonth).padStart(2, '0')}/${c.expYear}`}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                        {c.isDefault ? <Badge label="Par défaut" tone="brand" appearance="soft" /> : null}
                        <IconButton icon={Trash2} accessibilityLabel={`Supprimer la carte se terminant par ${c.last4}`} onPress={() => setToDelete(c)} />
                      </View>
                    }
                  />
                </View>
              ))}
            </Card>
          )}
        </QueryView>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Lock size={18} color={t.colors.text.secondary} />
          <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
            Vos données bancaires sont gérées par Stripe (certifié PCI-DSS). DEPANO ne voit jamais votre numéro de carte. Votre carte n'est débitée qu'à la fin d'une intervention.
          </Text>
        </View>
      </View>
      <ConfirmSheet
        visible={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id);
          setToDelete(null);
        }}
        title="Supprimer cette carte ?"
        message={toDelete ? `•••• ${toDelete.last4}. Les interventions en cours restent garanties.` : undefined}
        confirmLabel="Supprimer"
        tone="danger"
      />
    </Screen>
  );
}
