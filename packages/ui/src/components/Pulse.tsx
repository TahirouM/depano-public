import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { useReduceMotion } from '../utils/motion';

const HALF = { duration: 600, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System } as const;

/**
 * Pulsation douce (1 → 1,03 → 1, boucle ~1,2 s) avec halo qui s'étend, pour signaler
 * une nouvelle offre urgente. S'arrête proprement quand `active` repasse à false ;
 * statique si « Réduire les animations » est actif.
 */
export function Pulse({ active, children, style }: { active: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const progress = useSharedValue(0);
  const running = active && !reduce;

  useEffect(() => {
    if (running) {
      progress.value = 0;
      progress.value = withRepeat(withSequence(withTiming(1, HALF), withTiming(0, HALF)), -1, false, undefined, ReduceMotion.System);
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 150, reduceMotion: ReduceMotion.System });
    }
    return () => cancelAnimation(progress);
  }, [running, progress]);

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * progress.value }] }));
  // Halo : bordure qui grossit et s'estompe pendant la montée.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * progress.value,
    transform: [{ scale: 1 + 0.05 * progress.value }],
  }));

  return (
    <View style={style}>
      {running ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: t.radius.md, borderWidth: 2, borderColor: t.colors.tone.urgent.solid }, haloStyle]}
        />
      ) : null}
      <Animated.View style={contentStyle}>{children}</Animated.View>
    </View>
  );
}
