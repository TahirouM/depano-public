import { Button, Card, ErrorState, ProgressHeader, Screen, Skeleton, SlotPicker, Text, dayKey, formatDateTime, useTheme } from '@depano/ui';
import { Redirect, router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { useSlots } from '../queries';
import { useRdv } from './useRdv';

/** RDV 3 sur 4 : jours en scroll horizontal, créneaux en grille (passés/pris masqués). */
export function RdvSlotScreen({ artisanId }: { artisanId: string }) {
  const t = useTheme();
  const rdv = useRdv(artisanId);
  const { draft, patch } = rdv;
  const slots = useSlots(artisanId, draft.serviceId, 14);
  const [day, setDay] = useState<string | undefined>(draft.scheduledAt ? dayKey(draft.scheduledAt) : undefined);
  if (!draft.problemReason) return <Redirect href={{ pathname: '/rdv/type', params: { artisanId } }} />;

  return (
    <Screen
      footer={
        <Button
          label={draft.scheduledAt ? `Continuer · ${formatDateTime(draft.scheduledAt)}` : 'Choisissez un créneau'}
          size="lg"
          fullWidth
          disabled={!draft.scheduledAt}
          onPress={() => router.push({ pathname: '/rdv/recap', params: { artisanId } })}
          testID="rdv-slot-next"
        />
      }
    >
      <Stack.Screen options={{ title: 'Rendez-vous · Créneau', headerShown: true }} />
      <View style={{ gap: t.spacing.xl }}>
        <ProgressHeader step={3} total={4} title="Quand souhaitez-vous l'intervention ?" />
        {slots.data ? (
          <SlotPicker
            days={slots.data}
            value={draft.scheduledAt ?? null}
            onChange={(iso) => patch({ scheduledAt: iso })}
            selectedDay={day}
            onSelectDay={setDay}
            emptyAction={{ label: "Voir d'autres artisans", onPress: () => router.push({ pathname: '/recherche', params: rdv.domain ? { domain: rdv.domain } : {} }) }}
          />
        ) : slots.isError ? (
          <ErrorState fill={false} message={errorMessage(slots.error)} onRetry={() => void slots.refetch()} />
        ) : (
          <View style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} width={56} height={72} radius={t.radius.md} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Skeleton key={i} width={96} height={48} radius={t.radius.sm} />
              ))}
            </View>
          </View>
        )}
        <Card variant="flat" padding="md">
          <Text variant="callout" tone="secondary">
            Annulation gratuite jusqu'à 2 h avant. Rappel la veille et 1 h avant.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
