import { useCallback } from 'react';
import { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

const STEP = { duration: 50, reduceMotion: ReduceMotion.System } as const;

/**
 * Secousse horizontale (erreur de saisie) : ±8 px, ~300 ms au total.
 * `style` se pose sur un `Animated.View`, `shake()` déclenche l'animation.
 * Avec « Réduire les animations », la séquence est instantanée (aucun mouvement).
 */
export function useShake(distance = 8) {
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = useCallback(() => {
    x.value = withSequence(
      withTiming(-distance, STEP),
      withTiming(distance, STEP),
      withTiming(-distance * 0.75, STEP),
      withTiming(distance * 0.75, STEP),
      withTiming(-distance * 0.35, STEP),
      withTiming(0, STEP),
    );
  }, [x, distance]);
  return { style, shake };
}
