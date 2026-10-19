import { DOMAIN_LABELS, formatEuros, type BookingSummaryDto } from '@depano/schemas';
import { StyleSheet, View } from 'react-native';
import { MessageCircle, Siren } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { formatDateTime } from '../utils/format';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Card } from './Card';
import { Icon } from './Icon';
import { bookingStatusMeta, DOMAIN_ICONS, type Perspective } from './meta';
import { StatusChip } from './StatusChip';
import { Text } from './Text';

export interface InterventionCardProps {
  booking: BookingSummaryDto;
  onPress?: () => void;
  perspective?: Perspective;
}

export function InterventionCard({ booking: b, onPress, perspective = 'client' }: InterventionCardProps) {
  const t = useTheme();
  const domainC = t.colors.domain[b.domain];
  const when = b.scheduledAt ?? b.createdAt;
  const status = bookingStatusMeta(b.status, perspective);
  const a11y = [
    b.kind === 'urgent' ? 'Urgence' : 'Rendez-vous',
    DOMAIN_LABELS[b.domain],
    b.problemReason,
    status.label,
    formatDateTime(when),
    b.counterpart?.name,
    `total ${formatEuros(b.totalCents)}`,
    b.unreadMessages ? `${b.unreadMessages} message${b.unreadMessages > 1 ? 's' : ''} non lu${b.unreadMessages > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Card onPress={onPress} accessibilityLabel={a11y} accessibilityHint="Ouvre le détail de l'intervention">
      <View style={[styles.row, { gap: t.spacing.md }]}>
        <View style={[styles.domain, { backgroundColor: domainC.soft, borderRadius: t.radius.md }]}>
          <Icon icon={DOMAIN_ICONS[b.domain]} color={domainC.text} />
        </View>
        <View style={styles.flex}>
          <View style={[styles.row, { gap: t.spacing.xs }]}>
            {b.kind === 'urgent' ? <Icon icon={Siren} size={16} color={t.colors.tone.urgent.text} /> : null}
            <Text variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
              {b.serviceName ?? b.problemReason}
            </Text>
          </View>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {formatDateTime(when)} · {b.city}
          </Text>
        </View>
        <Text variant="label">{formatEuros(b.totalCents)}</Text>
      </View>
      <View style={[styles.row, styles.between, { marginTop: t.spacing.md, gap: t.spacing.sm }]}>
        <StatusChip status={b.status} perspective={perspective} size="sm" />
        <View style={[styles.row, { gap: t.spacing.sm }]}>
          {b.unreadMessages ? (
            <View style={[styles.row, { gap: 4 }]}>
              <Icon icon={MessageCircle} size={16} color={t.colors.text.secondary} />
              <Badge count={b.unreadMessages} tone="urgent" />
            </View>
          ) : null}
          {b.counterpart ? (
            <View style={[styles.row, { gap: t.spacing.xs }]}>
              <Avatar name={b.counterpart.name} uri={b.counterpart.avatarUrl} size={32} />
              <Text variant="callout" numberOfLines={1}>
                {b.counterpart.name}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between', flexWrap: 'wrap' },
  domain: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
});
