import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { usePressScale } from '../utils/pressScale';
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

// Pressable animé : l'échelle au toucher passe par un style Reanimated.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconButton({ icon, accessibilityLabel, onPress, badge, variant = 'plain', color, disabled, style, testID }: IconButtonProps) {
  const t = useTheme();
  // État « pressé » tenu en React : le style fonction ({ pressed }) ne se combine pas avec un style animé.
  const [pressed, setPressed] = useState(false);
  const press = usePressScale(0.9);
  const label = badge ? `${accessibilityLabel}, ${badge} non lu${badge > 1 ? 's' : ''}` : accessibilityLabel;
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        press.pressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        press.pressOut();
      }}
      style={[
        styles.base,
        {
          borderRadius: t.radius.full,
          backgroundColor: variant === 'filled' ? t.colors.background.subtle : pressed && !disabled ? t.colors.background.subtle : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
        press.style,
      ]}
    >
      <Icon icon={icon} color={color ?? t.colors.text.primary} />
      {badge ? (
        <View style={styles.badge} pointerEvents="none">
          <Badge count={badge} tone="urgent" />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 2 },
});
