import { DOMAIN_ICONS, Icon, useReduceMotion, useTheme } from '@depano/ui';
import type { DomainCode } from '@depano/schemas';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

function Ring({ delay, color, size }: { delay: number; color: string; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), -1, false));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 0.4 + p.value * 0.9 }] }));
  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color }, style]}
    />
  );
}

/** Animation « on cherche autour de vous » ; statique si « Réduire les animations ». */
export function SearchPulse({ domain, size = 220 }: { domain: DomainCode; size?: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const c = t.colors.tone.urgent;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessible={false} importantForAccessibility="no-hide-descendants">
      {reduce ? (
        <View style={{ position: 'absolute', width: size * 0.8, height: size * 0.8, borderRadius: size, borderWidth: 3, borderColor: c.soft }} />
      ) : (
        [0, 800, 1600].map((d) => <Ring key={d} delay={d} color={c.solid} size={size} />)
      )}
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.solid, alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={DOMAIN_ICONS[domain]} size={44} color={c.onSolid} />
      </View>
    </View>
  );
}
