import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';

/** Entrée en cascade des lignes de liste : fondu + montée de 8 px, décalage de 30 ms par rang (plafonné à 8). */
export function StaggerItem({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={FadeInUp.withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
        .duration(220)
        .delay(Math.min(Math.max(index, 0), 8) * 30)
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
