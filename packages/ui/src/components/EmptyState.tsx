import { StyleSheet, View } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button, type ButtonVariant } from './Button';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; variant?: ButtonVariant };
  secondaryAction?: { label: string; onPress: () => void };
  /** Occupe tout l'espace disponible et centre le contenu. */
  fill?: boolean;
}

/** État vide : illustration (icône) + message + CTA. */
export function EmptyState({ icon = Inbox, title, message, action, secondaryAction, fill }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, fill && styles.fill, { padding: t.spacing.xl, gap: t.spacing.md }]}>
      <View style={[styles.illu, { backgroundColor: t.colors.background.brand }]}>
        <Icon icon={icon} size={40} color={t.colors.text.primary} strokeWidth={1.75} />
      </View>
      <Text variant="title2" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="secondary" align="center">
          {message}
        </Text>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant={action.variant ?? 'primary'} style={{ marginTop: t.spacing.sm }} /> : null}
      {secondaryAction ? <Button label={secondaryAction.label} onPress={secondaryAction.onPress} variant="ghost" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  illu: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
});
