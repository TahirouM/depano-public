import { Pressable, StyleSheet } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { haptic } from '../utils/haptics';

export interface HeartButtonProps {
  active: boolean;
  onPress: () => void;
  /** Défaut : « Ajouter aux favoris » / « Retirer des favoris ». */
  accessibilityLabel?: string;
  /** Taille de l'icône (défaut 22). */
  size?: number;
  disabled?: boolean;
  testID?: string;
}

/** Bouton favori : cœur qui « saute » au tap, haptique de succès à l'ajout. */
export function HeartButton({ active, onPress, accessibilityLabel, size = 22, disabled, testID }: HeartButtonProps) {
  const t = useTheme();
  const color = t.colors.tone.urgent.text;
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (active ? 'Retirer des favoris' : 'Ajouter aux favoris')}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => {
        haptic(active ? 'light' : 'success');
        scale.value = withSequence(
          withTiming(1.3, { duration: 110, reduceMotion: ReduceMotion.System }),
          withSpring(1, { damping: 10, stiffness: 320, mass: 0.6, reduceMotion: ReduceMotion.System }),
        );
        onPress();
      }}
      style={[styles.base, disabled && styles.disabled]}
    >
      <Animated.View style={style}>
        <Heart size={size} color={color} fill={active ? color : 'transparent'} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
