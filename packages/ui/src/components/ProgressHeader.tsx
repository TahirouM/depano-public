import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export interface ProgressHeaderProps {
  step: number;
  total: number;
  /** La question de l'écran (une question par écran). */
  title?: string;
  subtitle?: string;
}

/** « Étape 2 sur 4 » + barre de progression. */
export function ProgressHeader({ step, total, title, subtitle }: ProgressHeaderProps) {
  const t = useTheme();
  const ratio = Math.min(1, Math.max(0, step / total));
  const bar = useAnimatedStyle(() => ({
    width: withTiming(`${ratio * 100}%`, { duration: 250, reduceMotion: ReduceMotion.System }),
  }));
  return (
    <View style={{ gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Étape ${step} sur ${total}`}
        accessibilityValue={{ min: 0, max: total, now: step }}
        style={{ gap: t.spacing.xs }}
      >
        <Text variant="label" tone="secondary">
          Étape {step} sur {total}
        </Text>
        <View style={[styles.track, { backgroundColor: t.colors.background.subtle, borderRadius: t.radius.full }]}>
          <Animated.View style={[styles.fill, { backgroundColor: t.colors.brand.primary, borderRadius: t.radius.full }, bar]} />
        </View>
      </View>
      {title ? <Text variant="title1">{title}</Text> : null}
      {subtitle ? (
        <Text variant="body" tone="secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Alias : le plan parle de « stepper ». */
export const Stepper = ProgressHeader;

const styles = StyleSheet.create({
  track: { height: 6, overflow: 'hidden' },
  fill: { height: 6 },
});
