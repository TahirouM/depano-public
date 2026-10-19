import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { Badge } from './Badge';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export interface ListItemProps {
  title: string;
  subtitle?: string | null;
  icon?: LucideIcon;
  /** Élément libre à gauche (Avatar…), prioritaire sur `icon`. */
  left?: ReactNode;
  /** Valeur courte à droite (ex. « Activées »). */
  value?: string;
  right?: ReactNode;
  badge?: number;
  chevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  testID?: string;
}

export function ListItem({
  title,
  subtitle,
  icon,
  left,
  value,
  right,
  badge,
  chevron,
  destructive,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  testID,
}: ListItemProps) {
  const t = useTheme();
  const fg = destructive ? t.colors.tone.danger.text : t.colors.text.primary;
  const showChevron = chevron ?? !!onPress;
  const a11y = accessibilityLabel ?? [title, subtitle, value, badge ? `${badge} non lus` : null].filter(Boolean).join(', ');
  const content = (
    <View style={[styles.row, { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md, gap: t.spacing.md }]}>
      {left ?? (icon ? <Icon icon={icon} color={destructive ? fg : t.colors.text.secondary} /> : null)}
      <View style={styles.texts}>
        <Text variant="body" color={fg}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="callout" tone="secondary">
          {value}
        </Text>
      ) : null}
      {badge ? <Badge count={badge} tone="urgent" /> : null}
      {right}
      {showChevron ? <Icon icon={ChevronRight} size={20} color={t.colors.text.secondary} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID} accessible accessibilityLabel={a11y} style={{ minHeight: MIN_TOUCH }}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: MIN_TOUCH, backgroundColor: pressed ? t.colors.background.subtle : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH },
  texts: { flex: 1, gap: 2 },
});
