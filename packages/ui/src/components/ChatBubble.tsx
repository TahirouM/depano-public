import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Check, CheckCheck, Clock, CircleAlert, Pause, Play } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { formatTime } from '../utils/format';
import { Icon } from './Icon';
import { Text } from './Text';

export type ChatDeliveryStatus = 'queued' | 'sending' | 'sent' | 'read' | 'failed';

export interface ChatBubbleProps {
  mine: boolean;
  kind: 'text' | 'image' | 'voice' | 'system';
  text?: string | null;
  imageUri?: string | null;
  voice?: { playing: boolean; onToggle: () => void; durationLabel?: string };
  createdAt: string;
  status?: ChatDeliveryStatus;
  onRetry?: () => void;
  onPressImage?: () => void;
}

const STATUS_LABEL: Record<ChatDeliveryStatus, string> = {
  queued: 'En attente de réseau',
  sending: 'Envoi…',
  sent: 'Envoyé',
  read: 'Lu',
  failed: 'Échec de l\'envoi',
};

export function ChatBubble({ mine, kind, text, imageUri, voice, createdAt, status, onRetry, onPressImage }: ChatBubbleProps) {
  const t = useTheme();
  if (kind === 'system') {
    return (
      <View style={[styles.system, { marginVertical: t.spacing.sm }]} accessible accessibilityLabel={text ?? ''}>
        <Text variant="caption" tone="secondary" align="center">
          {text}
        </Text>
      </View>
    );
  }
  const bg = mine ? t.colors.brand.primary : t.colors.background.surface;
  const fg = mine ? t.colors.brand.onPrimary : t.colors.text.primary;
  const failed = status === 'failed';
  const StatusIcon = status === 'read' ? CheckCheck : status === 'sent' ? Check : status === 'failed' ? CircleAlert : Clock;
  const a11y = [
    mine ? 'Vous' : 'Interlocuteur',
    kind === 'image' ? 'photo' : kind === 'voice' ? 'message vocal' : text,
    formatTime(createdAt),
    mine && status ? STATUS_LABEL[status] : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.wrap, mine ? styles.mine : styles.theirs, { marginVertical: 2 }]}>
      <View
        accessible
        accessibilityLabel={a11y}
        style={[
          styles.bubble,
          {
            backgroundColor: bg,
            borderRadius: t.radius.lg,
            borderBottomRightRadius: mine ? t.radius.sm / 2 : t.radius.lg,
            borderBottomLeftRadius: mine ? t.radius.lg : t.radius.sm / 2,
            padding: kind === 'image' ? 4 : t.spacing.md,
            opacity: status === 'queued' || status === 'sending' ? 0.85 : 1,
          },
          !mine && t.elevation(1),
        ]}
      >
        {kind === 'text' ? <Text color={fg}>{text}</Text> : null}
        {kind === 'image' && imageUri ? (
          <Pressable onPress={onPressImage} accessibilityRole="imagebutton" accessibilityLabel="Agrandir la photo">
            <Image source={{ uri: imageUri }} style={{ width: 220, height: 220, borderRadius: t.radius.md }} resizeMode="cover" />
          </Pressable>
        ) : null}
        {kind === 'voice' && voice ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={voice.playing ? 'Mettre en pause le message vocal' : 'Écouter le message vocal'}
            onPress={voice.onToggle}
            style={[styles.voice, { minHeight: MIN_TOUCH }]}
          >
            <Icon icon={voice.playing ? Pause : Play} color={fg} />
            <View style={[styles.wave, { backgroundColor: fg, opacity: 0.4 }]} />
            {voice.durationLabel ? (
              <Text variant="caption" color={fg}>
                {voice.durationLabel}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.meta, mine ? styles.mine : styles.theirs]}>
        <Text variant="caption" tone={failed ? 'danger' : 'secondary'}>
          {failed ? STATUS_LABEL.failed : status === 'queued' ? STATUS_LABEL.queued : formatTime(createdAt)}
        </Text>
        {mine && status ? <Icon icon={StatusIcon} size={14} color={failed ? t.colors.tone.danger.text : t.colors.text.secondary} /> : null}
        {failed && onRetry ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Réessayer l'envoi" onPress={onRetry} hitSlop={12}>
            <Text variant="caption" tone="brand" weight="semibold">
              Réessayer
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '82%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {},
  system: { alignSelf: 'center', maxWidth: '90%' },
  voice: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  wave: { flex: 1, height: 4, borderRadius: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingHorizontal: 4 },
});
