import type { ReviewDto } from '@depano/schemas';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  formatShortTimestamp,
  InterventionCard,
  ListItem,
  Screen,
  Chip,
  SkeletonList,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import {
  CalendarCheck,
  CalendarX2,
  MessageCircle,
  MessageSquareReply,
  Star,
} from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { useConversations } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { useArtisanBookings, useArtisanReviews } from '../queries';
import { ReviewCard } from './PublicPreviewScreen';

type Tab = 'bookings' | 'cancellations' | 'reviews' | 'messages';
const TABS: { value: Tab; label: string; icon: typeof Star }[] = [
  { value: 'bookings', label: 'Réservations', icon: CalendarCheck },
  { value: 'cancellations', label: 'Annulations', icon: CalendarX2 },
  { value: 'reviews', label: 'Avis', icon: Star },
  { value: 'messages', label: 'Messages', icon: MessageCircle },
];
const CANCELLED = ['cancelled_by_client', 'cancelled_by_artisan', 'expired'];

/** Activité : réservations, annulations, avis (réponse publique), messages. */
export function ActivityScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('bookings');
  return (
    <Screen inTabs testID="activity-screen">
      <Stack.Screen options={{ title: 'Activité' }} />
      <View style={{ gap: t.spacing.lg }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.spacing.sm }}
          accessibilityRole="tablist"
        >
          {TABS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              icon={o.icon}
              selected={tab === o.value}
              onPress={() => setTab(o.value)}
              testID={`activity-tab-${o.value}`}
            />
          ))}
        </ScrollView>
        {tab === 'bookings' || tab === 'cancellations' ? (
          <Bookings cancelled={tab === 'cancellations'} />
        ) : tab === 'reviews' ? (
          <Reviews />
        ) : (
          <Messages />
        )}
      </View>
    </Screen>
  );
}

function Bookings({ cancelled }: { cancelled: boolean }) {
  const t = useTheme();
  const q = useArtisanBookings({ scope: 'all', limit: 100 });
  return (
    <QueryView
      query={q}
      loading={<SkeletonList count={3} />}
      isEmpty={(d) => !d.items.some((b) => CANCELLED.includes(b.status) === cancelled)}
      empty={
        cancelled
          ? {
              icon: CalendarX2,
              title: 'Aucune annulation',
              message: 'Bravo : votre fiabilité est intacte.',
            }
          : {
              icon: CalendarCheck,
              title: 'Aucune réservation',
              message: 'Vos interventions passées et à venir apparaîtront ici.',
            }
      }
    >
      {(d) => (
        <View style={{ gap: t.spacing.sm }}>
          {cancelled ? (
            <Text variant="callout" tone="secondary">
              {d.items.filter((b) => b.status === 'cancelled_by_artisan').length} annulée(s) par
              vous · {d.items.filter((b) => b.status === 'cancelled_by_client').length} par le
              client
            </Text>
          ) : null}
          {d.items
            .filter((b) => CANCELLED.includes(b.status) === cancelled)
            .map((b) => (
              <InterventionCard
                key={b.id}
                booking={b}
                perspective="artisan"
                onPress={() =>
                  router.push({ pathname: '/pro/interventions/[id]', params: { id: b.id } })
                }
              />
            ))}
        </View>
      )}
    </QueryView>
  );
}

function Reviews() {
  const t = useTheme();
  const q = useArtisanReviews();
  const [replyTo, setReplyTo] = useState<ReviewDto | null>(null);
  return (
    <>
      <QueryView
        query={q}
        loading={<SkeletonList count={3} />}
        isEmpty={(d) => d.pages.every((p) => p.items.length === 0)}
        empty={{
          icon: Star,
          title: 'Pas encore d’avis',
          message: 'Les clients peuvent vous noter pendant 14 jours après la clôture.',
        }}
      >
        {(d) => (
          <View style={{ gap: t.spacing.sm }}>
            {d.pages
              .flatMap((p) => p.items)
              .map((r) => (
                <ReviewCard
                  key={r.id}
                  r={r}
                  footer={
                    r.reply ? null : (
                      <Button
                        label="Répondre publiquement"
                        icon={MessageSquareReply}
                        variant="ghost"
                        size="sm"
                        style={{ alignSelf: 'flex-start' }}
                        onPress={() => setReplyTo(r)}
                        testID={`reply-${r.id}`}
                      />
                    )
                  }
                />
              ))}
            {q.hasNextPage ? (
              <Button
                label="Voir plus d'avis"
                variant="ghost"
                loading={q.isFetchingNextPage}
                onPress={() => void q.fetchNextPage()}
              />
            ) : null}
          </View>
        )}
      </QueryView>
      <ReplySheet review={replyTo} onClose={() => setReplyTo(null)} />
    </>
  );
}

function ReplySheet({ review, onClose }: { review: ReviewDto | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const reply = useMutation({
    mutationFn: () => api.reviews.reply(review!.id, { body: body.trim() }),
    onSuccess: () => {
      toast.success('Réponse publiée.');
      setBody('');
      void qc.invalidateQueries({ queryKey: qk.artisan.reviews });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <BottomSheet
      visible={!!review}
      onClose={onClose}
      title={`Répondre à ${review?.authorFirstName ?? ''}`}
      description="Votre réponse sera visible de tous sur votre profil. Restez courtois et factuel."
      footer={
        <Button
          label="Publier la réponse"
          size="lg"
          fullWidth
          disabled={!body.trim()}
          loading={reply.isPending}
          onPress={() => reply.mutate()}
          testID="reply-send"
        />
      }
    >
      <TextField
        label="Votre réponse"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        testID="reply-body"
      />
    </BottomSheet>
  );
}

function Messages() {
  const q = useConversations();
  return (
    <QueryView
      query={q}
      loading={<SkeletonList count={3} variant="row" />}
      isEmpty={(d) => d.length === 0}
      empty={{
        icon: MessageCircle,
        title: 'Aucun message',
        message: 'Une conversation s’ouvre avec chaque intervention acceptée.',
      }}
    >
      {(d) => (
        <Card padding="none">
          {d.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider inset={72} /> : null}
              <ListItem
                left={<Avatar name={c.counterpart.name} uri={c.counterpart.avatarUrl} size={48} />}
                title={`${c.counterpart.name} · ${c.bookingReference}`}
                subtitle={c.lastMessage?.body ?? (c.lastMessage ? 'Pièce jointe' : 'Aucun message')}
                value={formatShortTimestamp(c.updatedAt)}
                badge={c.unreadCount || undefined}
                onPress={() =>
                  router.push({ pathname: '/pro/messages/[id]', params: { id: c.id } })
                }
              />
            </View>
          ))}
        </Card>
      )}
    </QueryView>
  );
}
