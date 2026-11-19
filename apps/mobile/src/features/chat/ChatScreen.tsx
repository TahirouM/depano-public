import type { ConversationDto, MessageDto } from '@depano/schemas';
import {
  Card,
  ChatBubble,
  DOMAIN_ICONS,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Skeleton,
  StatusChip,
  Text,
  haptic,
  relativeDayLabel,
  dayKey,
  useTheme,
  useToast,
  type ChatDeliveryStatus,
} from '@depano/ui';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Camera, ChevronRight, Image as ImageIcon, MessageCircleOff, Mic, Send, Square, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, api, errorMessage, isNetworkError } from '@/lib/api';
import { newClientId } from '@/lib/id';
import { useIsOnline } from '@/lib/online';
import { useConversations, useMessages } from '@/lib/query/hooks';
import { mk, qk } from '@/lib/query/keys';
import type { SendMessageVars } from '@/lib/query/mutations';
import { useRealtime } from '@/lib/realtime/RealtimeProvider';
import { useRealtimeEvent } from '@/lib/realtime/hooks';
import { pickImage } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth';
import { useOutboxStore, type OutboxMessage } from '@/stores/outbox';
import { AuthGate } from '@/components/AuthGate';

interface Row {
  key: string;
  mine: boolean;
  kind: MessageDto['kind'];
  text: string | null;
  uri: string | null;
  /** Messages vocaux : durée (serveur ou enregistrement local). */
  durationMs?: number | null;
  createdAt: string;
  status?: ChatDeliveryStatus;
  outbox?: OutboxMessage;
  /** Séparateur de jour affiché au-dessus du message. */
  dayLabel?: string;
}

const EMPTY_OUTBOX: OutboxMessage[] = [];

/**
 * Chat d'une intervention : texte, photos, messages vocaux ; carte d'intervention épinglée ;
 * envoi optimiste (clientId), file hors ligne, réessai en cas d'échec. Partagé client/artisan.
 */
export function ChatScreen({ conversationId, as }: { conversationId: string; as: 'client' | 'artisan' }) {
  return (
    <AuthGate title="Messagerie" message="Connectez-vous pour discuter avec votre interlocuteur.">
      <ChatInner conversationId={conversationId} as={as} />
    </AuthGate>
  );
}

function ChatInner({ conversationId, as }: { conversationId: string; as: 'client' | 'artisan' }) {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const myId = useAuthStore((s) => s.userId);
  const conversations = useConversations();
  const conversation = conversations.data?.find((c) => c.id === conversationId);
  const messages = useMessages(conversationId);
  const outbox = useOutboxStore((s) => s.items[conversationId] ?? EMPTY_OUTBOX);
  const send = useMutation<MessageDto, Error, SendMessageVars>({ mutationKey: mk.chatSend });
  const activeClientIds = useMutationState({
    filters: { mutationKey: mk.chatSend, status: 'pending' },
    select: (m) => (m.state.variables as SendMessageVars | undefined)?.clientId,
  });
  const [text, setText] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);
  const { socket } = useRealtime();

  // --- Lecture : marquer comme lu à l'ouverture et à chaque nouveau message reçu.
  const newestIncoming = messages.data?.pages[0]?.items.find((m) => m.senderId !== myId)?.id;
  const markRead = useCallback(() => {
    api.chat
      .markRead(conversationId)
      .then(() => {
        qc.setQueryData<ConversationDto[]>(qk.chat.conversations, (old) => old?.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
        void qc.invalidateQueries({ queryKey: qk.badges });
      })
      .catch(() => undefined);
  }, [conversationId, qc]);
  useFocusEffect(markRead);
  useEffect(() => {
    if (newestIncoming) markRead();
  }, [newestIncoming, markRead]);

  // --- « écrit… »
  useRealtimeEvent('typing', (e) => {
    if (e.conversationId !== conversationId || e.userId === myId) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3000);
  });
  const onChangeText = (v: string) => {
    setText(v);
    const now = Date.now();
    if (socket && now - lastTypingEmit.current > 2000) {
      lastTypingEmit.current = now;
      socket.emit('typing', { conversationId });
    }
  };

  // --- Fusion messages serveur + file locale (optimistic), du plus récent au plus ancien.
  const rows = useMemo<Row[]>(() => {
    const server = (messages.data?.pages ?? []).flatMap((p) => p.items);
    const seenIds = new Set<string>();
    const serverClientIds = new Set(server.map((m) => m.clientId).filter(Boolean) as string[]);
    const list: Row[] = [];
    for (const m of server) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      const mine = !!myId && m.senderId === myId;
      list.push({
        key: m.id,
        mine,
        kind: m.kind,
        text: m.body,
        uri: m.fileUrl,
        durationMs: m.durationMs ?? null,
        createdAt: m.createdAt,
        status: mine ? (m.readAt ? 'read' : 'sent') : undefined,
      });
    }
    for (const o of outbox) {
      if (serverClientIds.has(o.clientId)) continue;
      const inFlight = activeClientIds.includes(o.clientId);
      const status: ChatDeliveryStatus = o.status === 'failed' || !inFlight ? 'failed' : online ? 'sending' : 'queued';
      list.push({ key: `local-${o.clientId}`, mine: true, kind: o.kind, text: o.body ?? null, uri: o.localUri ?? null, durationMs: o.durationMs ?? null, createdAt: o.createdAt, status, outbox: o });
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // Séparateurs de jour (liste inversée : le libellé va sur le dernier message de chaque jour).
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]!;
      const older = list[i + 1];
      if (!older || dayKey(older.createdAt) !== dayKey(cur.createdAt)) cur.dayLabel = relativeDayLabel(cur.createdAt);
    }
    return list;
  }, [messages.data, outbox, activeClientIds, online, myId]);

  // --- Envoi
  const enqueue = (vars: Omit<SendMessageVars, 'clientId' | 'conversationId' | 'createdAt'>) => {
    haptic('light');
    send.mutate({ ...vars, clientId: newClientId(), conversationId, createdAt: new Date().toISOString() });
  };
  const retry = (o: OutboxMessage) => {
    const { status: _s, ...vars } = o;
    useOutboxStore.getState().update(conversationId, o.clientId, { status: 'pending' });
    send.mutate(vars);
  };
  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    enqueue({ kind: 'text', body });
  };
  const sendPhoto = async (source: 'library' | 'camera') => {
    const file = await pickImage(source);
    if (file) enqueue({ kind: 'image', localUri: file.uri, contentType: file.contentType });
  };

  // --- Messages vocaux (expo-audio)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const startRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        toast.show({ message: 'Autorisez le micro dans les réglages pour envoyer un message vocal.', type: 'info' });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      haptic('medium');
    } catch (e) {
      toast.error(errorMessage(e, 'Impossible de démarrer l’enregistrement.'));
    }
  };
  const stopRecording = async (keep: boolean) => {
    try {
      await recorder.stop();
    } finally {
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    }
    if (keep && recorder.uri) enqueue({ kind: 'voice', localUri: recorder.uri, contentType: 'audio/m4a', durationMs: recState.durationMillis });
  };

  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  useEffect(() => {
    if (playerStatus.didJustFinish) setPlayingKey(null);
  }, [playerStatus.didJustFinish]);
  const toggleVoice = (key: string, uri: string | null) => {
    if (!uri) return;
    if (playingKey === key && playerStatus.playing) {
      player.pause();
      setPlayingKey(null);
      return;
    }
    player.replace({ uri });
    player.play();
    setPlayingKey(key);
  };

  const title = conversation?.counterpart.name ?? 'Conversation';
  const canVoice = Platform.OS !== 'web';
  const seconds = Math.floor((recState.durationMillis ?? 0) / 1000);

  // Messagerie fermée (demande pas encore acceptée par l'artisan, ou conversation clôturée) : l'API refuse l'accès.
  if (isChatClosedError(messages.error) && !messages.data) {
    return (
      <View style={[styles.flex, { backgroundColor: t.colors.background.canvas }]} testID="chat-closed">
        <Stack.Screen options={{ title }} />
        <EmptyState
          fill
          icon={MessageCircleOff}
          title="Messagerie pas encore ouverte"
          message={
            as === 'client'
              ? "La conversation s'ouvre dès que l'artisan accepte votre demande. Vous serez prévenu."
              : "La conversation s'ouvre dès que vous acceptez la demande du client."
          }
          action={{ label: 'Retour', onPress: () => (router.canGoBack() ? router.back() : router.replace(as === 'client' ? '/messages' : '/pro/messages')) }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background.canvas }]}>
      <Stack.Screen options={{ title }} />
      {conversation ? <PinnedBookingCard conversation={conversation} as={as} /> : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        {messages.isError && !messages.data ? (
          <ErrorState offline={isNetworkError(messages.error)} message={errorMessage(messages.error)} onRetry={() => void messages.refetch()} />
        ) : messages.isPending && !messages.data && outbox.length === 0 ? (
          <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
            <Skeleton width="60%" height={44} radius={t.radius.lg} />
            <Skeleton width="45%" height={44} radius={t.radius.lg} style={{ alignSelf: 'flex-end' }} />
            <Skeleton width="70%" height={44} radius={t.radius.lg} />
          </View>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xs }}
            keyboardShouldPersistTaps="handled"
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <View style={{ transform: [{ scaleY: -1 }], paddingVertical: t.spacing.xxl }}>
                <Text tone="secondary" align="center">
                  Écrivez votre premier message. Vos échanges restent dans l’app : pas besoin de partager votre numéro.
                </Text>
              </View>
            }
            renderItem={({ item: r }) => (
              <View>
                {r.dayLabel ? (
                  <Text variant="caption" tone="secondary" align="center" style={{ marginVertical: t.spacing.sm }}>
                    {r.dayLabel}
                  </Text>
                ) : null}
                <ChatBubble
                  mine={r.mine}
                  kind={r.kind}
                  text={r.text}
                  imageUri={r.kind === 'image' ? r.uri : null}
                  voice={
                    r.kind === 'voice'
                      ? { playing: playingKey === r.key && playerStatus.playing, onToggle: () => toggleVoice(r.key, r.uri), durationMs: r.durationMs }
                      : undefined
                  }
                  createdAt={r.createdAt}
                  status={r.status}
                  onRetry={r.outbox ? () => retry(r.outbox!) : undefined}
                  onPressImage={r.uri ? () => setViewer(r.uri) : undefined}
                />
              </View>
            )}
          />
        )}
        {typing ? (
          <Text variant="caption" tone="secondary" style={{ paddingHorizontal: t.spacing.lg }} accessibilityLiveRegion="polite">
            {title} écrit…
          </Text>
        ) : null}
        <View
          style={[
            styles.composer,
            { paddingBottom: insets.bottom + t.spacing.sm, paddingHorizontal: t.spacing.sm, paddingTop: t.spacing.sm, backgroundColor: t.colors.background.surface, borderTopColor: t.colors.border.subtle },
          ]}
        >
          {recording ? (
            <>
              <IconButton icon={Trash2} accessibilityLabel="Annuler l'enregistrement" onPress={() => void stopRecording(false)} color={t.colors.tone.danger.text} />
              <View style={[styles.flex, styles.recRow]} accessibilityLiveRegion="polite">
                <View style={[styles.recDot, { backgroundColor: t.colors.tone.urgent.solid }]} />
                <Text variant="label">
                  Enregistrement… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </Text>
              </View>
              <IconButton icon={Square} accessibilityLabel="Arrêter et envoyer le message vocal" variant="filled" onPress={() => void stopRecording(true)} />
            </>
          ) : (
            <>
              <IconButton icon={Camera} accessibilityLabel="Prendre une photo" onPress={() => void sendPhoto('camera')} />
              <IconButton icon={ImageIcon} accessibilityLabel="Joindre une photo" onPress={() => void sendPhoto('library')} />
              <TextInput
                value={text}
                onChangeText={onChangeText}
                placeholder="Votre message"
                placeholderTextColor={t.colors.text.secondary}
                accessibilityLabel="Votre message"
                multiline
                maxLength={4000}
                maxFontSizeMultiplier={2}
                style={[
                  styles.input,
                  t.text('body'),
                  { color: t.colors.text.primary, backgroundColor: t.colors.background.subtle, borderRadius: t.radius.lg, paddingHorizontal: t.spacing.md },
                ]}
              />
              {text.trim() || !canVoice ? (
                <IconButton icon={Send} accessibilityLabel="Envoyer" onPress={sendText} disabled={!text.trim()} color={t.colors.text.brand} />
              ) : (
                <IconButton icon={Mic} accessibilityLabel="Enregistrer un message vocal" onPress={() => void startRecording()} />
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={[styles.viewer, { paddingTop: insets.top }]}>
          <IconButton icon={X} accessibilityLabel="Fermer la photo" color="#FFFFFF" onPress={() => setViewer(null)} style={{ alignSelf: 'flex-end' }} />
          {viewer ? <Image source={{ uri: viewer }} style={styles.flex} resizeMode="contain" accessibilityLabel="Photo en grand" /> : null}
        </View>
      </Modal>
    </View>
  );
}

/** 403 / 409 : conversation inaccessible tant que l'artisan n'a pas accepté (`chatIsOpen`). */
export function isChatClosedError(e: unknown): boolean {
  return e instanceof ApiError && !e.isNetwork && (e.status === 403 || e.status === 409);
}

/** Carte d'intervention épinglée en haut du chat. */
function PinnedBookingCard({ conversation: c, as }: { conversation: ConversationDto; as: 'client' | 'artisan' }) {
  const t = useTheme();
  const domain = t.colors.domain[c.domain];
  const open = () =>
    router.push(as === 'client' ? { pathname: '/activite/[id]', params: { id: c.bookingId } } : { pathname: '/pro/interventions/[id]', params: { id: c.bookingId } });
  return (
    <View style={{ paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm }}>
      <Card padding="md" onPress={open} accessibilityLabel={`Intervention ${c.bookingReference}`} accessibilityHint="Ouvre le détail de l'intervention">
        <View style={[styles.recRow, { gap: t.spacing.md }]}>
          <View style={[styles.domainIcon, { backgroundColor: domain.soft, borderRadius: t.radius.sm }]}>
            <Icon icon={DOMAIN_ICONS[c.domain]} size={20} color={domain.text} />
          </View>
          <View style={[styles.flex, { gap: 4 }]}>
            <Text variant="label">Intervention {c.bookingReference}</Text>
            <StatusChip status={c.bookingStatus} perspective={as} size="sm" />
          </View>
          <Pressable accessibilityElementsHidden importantForAccessibility="no">
            <Icon icon={ChevronRight} size={20} color={t.colors.text.secondary} />
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  input: { flex: 1, minHeight: 44, maxHeight: 140, paddingTop: 10, paddingBottom: 10, marginVertical: 2 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  domainIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
