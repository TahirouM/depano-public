import type { ConversationDto } from '@depano/schemas';
import { Avatar, Badge, Divider, DomainChip, Screen, StatusChip, Text, formatShortTimestamp, useTheme, SkeletonList } from '@depano/ui';
import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { QueryView } from '@/components/QueryView';
import { useConversations } from '@/lib/query/hooks';
import { useAuthStore } from '@/stores/auth';

function preview(c: ConversationDto, myId: string | null): string {
  const m = c.lastMessage;
  if (!m) return 'Aucun message pour l’instant';
  const prefix = m.senderId && m.senderId === myId ? 'Vous : ' : '';
  if (m.kind === 'image') return `${prefix}Photo`;
  if (m.kind === 'voice') return `${prefix}Message vocal`;
  return `${prefix}${m.body ?? ''}`;
}

/** Liste des conversations (une par intervention), badge non lu. Partagée client/artisan. */
export function ConversationsScreen({ as }: { as: 'client' | 'artisan' }) {
  const t = useTheme();
  const q = useConversations();
  const myId = useAuthStore((s) => s.userId);
  return (
    <Screen scroll={false} padded={false} inTabs>
      <AuthGate icon={MessageCircle} title="Vos messages" message="Connectez-vous pour échanger avec vos artisans pendant une intervention.">
        <QueryView
          query={q}
          loading={<View style={{ paddingTop: t.spacing.lg }}><SkeletonList variant="row" count={6} /></View>}
          isEmpty={(d) => d.length === 0}
          empty={{
            icon: MessageCircle,
            title: 'Pas encore de conversation',
            message:
              as === 'client'
                ? 'Une conversation s’ouvre avec l’artisan dès qu’il accepte votre demande.'
                : 'Une conversation s’ouvre avec le client dès que vous acceptez une intervention.',
          }}
        >
          {(data) => (
            <FlatList
              data={[...data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
              keyExtractor={(c) => c.id}
              // Tabs natives iOS : la tab bar flotte au-dessus de la liste ; UIKit ajoute l'inset bas.
              contentInsetAdjustmentBehavior="automatic"
              ItemSeparatorComponent={() => <Divider inset={80} />}
              refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={t.colors.brand.primary} />}
              renderItem={({ item: c }) => {
                const unread = c.unreadCount > 0;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${c.counterpart.name}, intervention ${c.bookingReference}. ${preview(c, myId)}${unread ? `. ${c.unreadCount} non lus` : ''}`}
                    onPress={() => router.push(as === 'client' ? { pathname: '/messages/[id]', params: { id: c.id } } : { pathname: '/pro/messages/[id]', params: { id: c.id } })}
                    style={({ pressed }) => [styles.row, { padding: t.spacing.lg, gap: t.spacing.md, backgroundColor: pressed ? t.colors.background.subtle : 'transparent' }]}
                  >
                    <Avatar name={c.counterpart.name} uri={c.counterpart.avatarUrl} size={48} />
                    <View style={styles.flex}>
                      <View style={[styles.row, { gap: t.spacing.sm }]}>
                        <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                          {c.counterpart.name}
                        </Text>
                        <Text variant="caption" tone={unread ? 'brand' : 'secondary'}>
                          {formatShortTimestamp(c.lastMessage?.createdAt ?? c.updatedAt)}
                        </Text>
                      </View>
                      <View style={[styles.row, { gap: t.spacing.sm }]}>
                        <Text variant="callout" tone={unread ? 'primary' : 'secondary'} weight={unread ? 'semibold' : undefined} numberOfLines={1} style={styles.flex}>
                          {preview(c, myId)}
                        </Text>
                        {unread ? <Badge count={c.unreadCount} tone="urgent" /> : null}
                      </View>
                      <View style={[styles.row, { gap: t.spacing.xs, marginTop: t.spacing.xs, flexWrap: 'wrap' }]}>
                        <DomainChip domain={c.domain} size="sm" />
                        <StatusChip status={c.bookingStatus} perspective={as} size="sm" />
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </QueryView>
      </AuthGate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
