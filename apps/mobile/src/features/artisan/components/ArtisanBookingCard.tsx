import type { BookingSummaryDto } from '@depano/schemas';
import { InterventionCard, Text, useTheme } from '@depano/ui';
import { router } from 'expo-router';
import { Hourglass, StickyNote } from 'lucide-react-native';
import { View } from 'react-native';
import { RequestActions, RequestCard } from './RequestCard';

const open = (id: string) => router.push({ pathname: '/pro/interventions/[id]', params: { id } });

/**
 * Intervention dans les listes artisan : demande à traiter (Accepter / Refuser), prix proposé en attente
 * du client, sinon la carte standard ; la note privée apparaît en extrait.
 */
export function ArtisanBookingCard({ booking: b }: { booking: BookingSummaryDto }) {
  const t = useTheme();
  if (b.status === 'requested')
    return (
      <RequestCard booking={b} onPress={() => open(b.id)} footer={<RequestActions booking={b} />} />
    );
  const waitingClient = b.status === 'pending_payment' && b.artisanAccepted;
  return (
    <View style={{ gap: t.spacing.xs }}>
      <InterventionCard booking={b} perspective="artisan" onPress={() => open(b.id)} />
      {waitingClient ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
            paddingHorizontal: t.spacing.sm,
          }}
        >
          <Hourglass size={14} color={t.colors.tone.info.text} />
          <Text variant="caption" tone="info" style={{ flex: 1 }}>
            En attente de confirmation du client
            {b.priceOnRequest ? ' (prix proposé)' : ''}
          </Text>
        </View>
      ) : null}
      {b.artisanNote ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
            paddingHorizontal: t.spacing.sm,
          }}
          accessibilityLabel={`Note privée : ${b.artisanNote}`}
        >
          <StickyNote size={14} color={t.colors.text.secondary} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {b.artisanNote}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
