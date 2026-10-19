import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Briefcase, House } from 'lucide-react-native';
import { createTheme, useTheme } from '../theme/ThemeProvider';
import type { Accent } from '../tokens/colors';
import { Icon } from './Icon';
import { Text } from './Text';

export interface AccentTransitionProps {
  /** true : le voile coloré couvre l'écran ; false : il s'efface. */
  visible: boolean;
  /** Espace de destination (sa couleur remplit l'écran). */
  accent: Accent;
  label?: string;
}

/**
 * Transition de couleur lors du changement de rôle (client ↔ artisan),
 * pour éviter toute confusion d'espace. Fondu simple si « réduire les animations ».
 */
export function AccentTransition({ visible, accent, label }: AccentTransitionProps) {
  const parent = useTheme();
  const target = createTheme(parent.scheme, accent, parent.fonts);
  const [mounted, setMounted] = useState(visible);
  const o = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      o.value = withTiming(1, { duration: 250, reduceMotion: ReduceMotion.System });
    } else {
      o.value = withTiming(0, { duration: 300, reduceMotion: ReduceMotion.System }, (done) => {
        'worklet';
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [visible, o]);

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.98 + o.value * 0.02 }] }));
  if (!mounted) return null;
  const text = label ?? (accent === 'artisan' ? 'Espace artisan' : 'Espace client');
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`Passage à l'${text.toLowerCase()}`}
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: target.colors.brand.primary, zIndex: 2000 }, style]}
    >
      <View style={[styles.center, { gap: parent.spacing.md }]}>
        <Icon icon={accent === 'artisan' ? Briefcase : House} size={48} color={target.colors.brand.onPrimary} />
        <Text variant="title1" color={target.colors.brand.onPrimary}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
