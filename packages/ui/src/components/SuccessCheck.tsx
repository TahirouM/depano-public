import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { haptic as runHaptic } from '../utils/haptics';
import { useReduceMotion } from '../utils/motion';

export interface SuccessCheckProps {
  /** Diamètre en px (défaut 72). */
  size?: number;
  tone?: 'success' | 'brand';
  /** Retour haptique « succès » une fois la coche dessinée (défaut true). */
  haptic?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Tracé de la coche dans un viewBox 52×52 ; longueur ≈ 33,3 (arrondie au-dessus). */
const CHECK = 'M15 27 L23 35 L38 19';
const CHECK_LENGTH = 34;

/** Confirmation visuelle : pastille qui apparaît en ressort puis coche qui se dessine. */
export function SuccessCheck({ size = 72, tone = 'success', haptic = true, accessibilityLabel = 'Succès', testID }: SuccessCheckProps) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const bg = tone === 'success' ? t.colors.tone.success.solid : t.colors.brand.primary;
  const fg = tone === 'success' ? t.colors.tone.success.onSolid : t.colors.brand.onPrimary;

  // Avec « Réduire les animations » : état final immédiat.
  const scale = useSharedValue(reduce ? 1 : 0.6);
  const opacity = useSharedValue(reduce ? 1 : 0);
  const dash = useSharedValue(reduce ? 0 : CHECK_LENGTH);

  useEffect(() => {
    if (!reduce) {
      scale.value = withSpring(1, { damping: 12, stiffness: 260, mass: 0.7, reduceMotion: ReduceMotion.System });
      opacity.value = withTiming(1, { duration: 150, reduceMotion: ReduceMotion.System });
      dash.value = withDelay(
        120,
        withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
        ReduceMotion.System,
      );
    }
    // Haptique au moment où la coche finit de se tracer (immédiat sans animation).
    if (!haptic) return;
    const id = setTimeout(() => runHaptic('success'), reduce ? 0 : 300);
    return () => clearTimeout(id);
    // Une seule fois au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const circleStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, circleStyle]}>
        <Svg width={size} height={size} viewBox="0 0 52 52">
          <AnimatedPath
            d={CHECK}
            fill="none"
            stroke={fg}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[CHECK_LENGTH, CHECK_LENGTH]}
            animatedProps={pathProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
