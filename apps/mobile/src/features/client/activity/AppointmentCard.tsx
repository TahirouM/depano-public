import type { BookingSummaryDto } from '@depano/schemas';
import { Avatar, Button, Card, Icon, StatusChip, Text, formatDateTime, formatTime, relativeDayLabel, useTheme } from '@depano/ui';
import { router } from 'expo-router';
import { Hourglass, MessageCircle } from 'lucide-react-native';
import { View } from 'react-native';
import { interventionHref } from '@/components/PinnedInterventionHost';
import { PRICE_ON_REQUEST_LABEL } from '../rdv/useRdv';
import { awaitingPrice, chatOpenFor, kindDomainLabel, proposalOf, requestDeadline } from './bookingState';
import { ProposalActions } from './ProposalActions';

/** Statuts où le client peut encore annuler depuis la liste (frais affichés dans la feuille d'annulation). */
const CANCELLABLE = ['requested', 'searching', 'accepted', 'en_route'];

export interface AppointmentCardProps {
  booking: BookingSummaryDto;
  /** Conversation de l'intervention (null tant que la messagerie n'est pas ouverte). */
  conversationId: string | null;
  onCancel: (id: string) => void;
}

/** Rendez-vous de « Mes rendez-vous » : artisan, métier, date, Message / Annuler, ou proposition à accepter. */
export function AppointmentCard({ booking: b, conversationId, onCancel }: AppointmentCardProps) {
  const t = useTheme();
  const name = b.counterpart?.name ?? 'Artisan à confirmer';
  const when = b.scheduledAt ? `${relativeDayLabel(b.scheduledAt)} à ${formatTime(b.scheduledAt)}` : `Demandée ${relativeDayLabel(b.createdAt).toLowerCase()}`;
  const proposal = proposalOf(b);
  const chatOpen = chatOpenFor(b) && !!conversationId;
  const waiting = b.status === 'requested' || (b.status === 'pending_payment' && !b.artisanAccepted);

  return (
    <Card padding="md" style={{ gap: t.spacing.md }} testID={`appointment-${b.id}`}>
      <Card
        variant="flat"
        padding="none"
        onPress={() => router.push(interventionHref(b, 'client'))}
        accessibilityLabel={`${name}, ${kindDomainLabel(b)}, ${b.scheduledAt ? formatDateTime(b.scheduledAt) : when}. Voir le détail`}
        style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center', backgroundColor: 'transparent' }}
      >
        <Avatar name={name} uri={b.counterpart?.avatarUrl ?? null} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {kindDomainLabel(b)} · {b.serviceName ?? b.problemReason}
          </Text>
          <Text variant="callout">{when}</Text>
          <View style={{ flexDirection: 'row', marginTop: 2 }}>
            <StatusChip status={b.status} size="sm" />
          </View>
        </View>
      </Card>

      {proposal ? (
        <ProposalActions booking={b} compact />
      ) : (
        <>
          {waiting ? (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Icon icon={Hourglass} size={18} color={t.colors.tone.warning.text} />
              <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
                En attente de l'artisan · réponse au plus tard {relativeDayLabel(requestDeadline(b)).toLowerCase()} à {formatTime(requestDeadline(b))}
                {awaitingPrice(b) ? ` · ${PRICE_ON_REQUEST_LABEL}` : ''}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button
              variant="secondary"
              size="sm"
              icon={MessageCircle}
              label={chatOpen ? (b.unreadMessages ? `Message (${b.unreadMessages})` : 'Message') : "En attente de l'artisan"}
              disabled={!chatOpen}
              accessibilityHint={chatOpen ? undefined : "La messagerie s'ouvre dès que l'artisan accepte votre demande"}
              onPress={() => conversationId && router.push({ pathname: '/messages/[id]', params: { id: conversationId } })}
              style={{ flex: 1 }}
              testID="appointment-message"
            />
            {CANCELLABLE.includes(b.status) ? (
              <Button variant="ghost" size="sm" label="Annuler" onPress={() => onCancel(b.id)} style={{ flex: 1 }} testID="appointment-cancel" />
            ) : null}
          </View>
        </>
      )}
    </Card>
  );
}
