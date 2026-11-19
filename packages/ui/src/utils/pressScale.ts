import { useCallback } from 'react';
import { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/** Ressort amorti, court (~200 ms), coupé si « Réduire les animations » est actif. */
const SPRING = { damping: 18, stiffness: 400, mass: 0.6, reduceMotion: ReduceMotion.System } as const;

/** Échelle au toucher (boutons) : `onPressIn`/`onPressOut` à brancher sur un Pressable animé. */
export function usePressScale(pressedScale: number) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressIn = useCallback(() => {
    scale.value = withSpring(pressedScale, SPRING);
  }, [scale, pressedScale]);
  const pressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING);
  }, [scale]);
  return { style, pressIn, pressOut };
}
