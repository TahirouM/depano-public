import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { haptic as runHaptic, type HapticKind } from '../utils/haptics';
import { usePressScale } from '../utils/pressScale';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'urgent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
  /** Retour haptique au tap (ex. 'success' pour un paiement validé). */
  haptic?: HapticKind;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
}

// Pressable animé : l'échelle au toucher passe par un style Reanimated.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: MIN_TOUCH, lg: 56 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  fullWidth = false,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const t = useTheme();
  const c = t.colors;
  const inactive = disabled || loading;
  // État « pressé » tenu en React : le style fonction ({ pressed }) ne se combine pas avec un style animé.
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(0.97);

  const palette: Record<ButtonVariant, { bg: string; bgPressed: string; fg: string; border?: string }> = {
    primary: { bg: c.brand.primary, bgPressed: c.brand.primaryPressed, fg: c.brand.onPrimary },
    secondary: { bg: c.brand.surface, bgPressed: c.brand.outline, fg: c.text.primary, border: c.brand.outline },
    ghost: { bg: 'transparent', bgPressed: c.background.subtle, fg: c.text.primary },
    danger: { bg: c.tone.danger.solid, bgPressed: c.tone.danger.text, fg: c.tone.danger.onSolid },
    urgent: { bg: c.tone.urgent.solid, bgPressed: c.tone.urgent.text, fg: c.tone.urgent.onSolid },
  };
  const p = palette[variant];
  const fg = disabled ? c.text.disabled : p.fg;
  const iconSize = size === 'lg' ? 24 : 20;

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={size === 'sm' ? 4 : undefined}
      onPressIn={() => {
        setPressed(true);
        press.pressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        press.pressOut();
      }}
      onPress={() => {
        if (haptic) runHaptic(haptic);
        onPress?.();
      }}
      style={[
        styles.base,
        {
          minHeight: HEIGHT[size],
          paddingHorizontal: size === 'sm' ? t.spacing.md : t.spacing.xl,
          borderRadius: t.radius.md,
          backgroundColor: disabled ? c.background.subtle : pressed && !inactive ? p.bgPressed : p.bg,
          ...(p.border && !disabled ? { borderWidth: 1, borderColor: p.border } : null),
        },
        fullWidth && styles.fullWidth,
        style,
        press.style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={fg} accessibilityElementsHidden />
        ) : icon ? (
          <Icon icon={icon} size={iconSize} color={fg} />
        ) : null}
        <Text
          variant={size === 'sm' ? 'label' : 'bodyStrong'}
          color={fg}
          numberOfLines={2}
          align="center"
          style={styles.label}
        >
          {label}
        </Text>
        {iconRight && !loading ? <Icon icon={iconRight} size={iconSize} color={fg} /> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { flexShrink: 1 },
});
