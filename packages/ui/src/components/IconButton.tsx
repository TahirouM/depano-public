import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { Badge } from './Badge';
import { Icon, type LucideIcon } from './Icon';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Obligatoire : seul vecteur de sens pour VoiceOver/TalkBack. */
  accessibilityLabel: string;
  onPress?: () => void;
  badge?: number;
  variant?: 'plain' | 'filled';
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({ icon, accessibilityLabel, onPress, badge, variant = 'plain', color, disabled, style, testID }: IconButtonProps) {
  const t = useTheme();
  const label = badge ? `${accessibilityLabel}, ${badge} non lu${badge > 1 ? 's' : ''}` : accessibilityLabel;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: t.radius.full,
          backgroundColor: variant === 'filled' ? t.colors.background.subtle : pressed ? t.colors.background.subtle : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Icon icon={icon} color={color ?? t.colors.text.primary} />
      {badge ? (
        <View style={styles.badge} pointerEvents="none">
          <Badge count={badge} tone="urgent" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 2 },
});
