import { ReduceMotion, useReducedMotion, withTiming, type WithTimingConfig } from 'react-native-reanimated';
import { motion } from '../tokens/scale';

/** Config de timing standard : 250 ms, désactivée si « Réduire les animations » est actif. */
export const timing = (duration: number = motion.base): WithTimingConfig => ({
  duration,
  reduceMotion: ReduceMotion.System,
});

export function animateTo(value: number, duration: number = motion.base) {
  'worklet';
  return withTiming(value, { duration, reduceMotion: ReduceMotion.System });
}

/** true si l'utilisateur a demandé à réduire les animations. */
export const useReduceMotion = useReducedMotion;
