import type { BookingStatus } from '@depano/schemas';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { Icon } from './Icon';
import { bookingStatusMeta, type Perspective } from './meta';
import { Text } from './Text';

export interface PinnedInterventionBarProps {
  status: BookingStatus;
  /** Ex. « Fuite sous évier ». */
  title: string;
  /** Ex. « Karim B. · arrivée dans 12 min ». */
  subtitle?: string | null;
  perspective?: Perspective;
  onPress: () => void;
}

/** Intervention en cours épinglée au-dessus de la tab bar, comme un mini-lecteur audio. */
export function PinnedInterventionBar({ status, title, subtitle, perspective = 'client', onPress }: PinnedInterventionBarProps) {
  const t = useTheme();
  const m = bookingStatusMeta(status, perspective);
  const tone = t.colors.tone[m.tone];
  return (
    <Animated.View
      entering={FadeInDown.duration(250).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(200).reduceMotion(ReduceMotion.System)}
      style={{ paddingHorizontal: t.spacing.sm, paddingBottom: t.spacing.xs }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Intervention en cours : ${m.label}. ${title}${subtitle ? `. ${subtitle}` : ''}`}
        accessibilityHint="Ouvre le suivi"
        onPress={onPress}
        style={({ pressed }) => [
          styles.bar,
          {
            minHeight: MIN_TOUCH + 8,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.background.surface,
            paddingHorizontal: t.spacing.md,
            gap: t.spacing.md,
            opacity: pressed ? 0.9 : 1,
            borderLeftWidth: 4,
            borderLeftColor: tone.solid,
          },
          t.elevation(3),
        ]}
      >
        <View style={[styles.icon, { backgroundColor: tone.soft, borderRadius: t.radius.full }]}>
          <Icon icon={m.icon} size={20} color={tone.text} />
        </View>
        <View style={styles.flex}>
          <Text variant="label" tone={m.tone} numberOfLines={1}>
            {m.label}
          </Text>
          <Text variant="callout" numberOfLines={1}>
            {subtitle ? `${title} · ${subtitle}` : title}
          </Text>
        </View>
        <Icon icon={ChevronRight} size={20} color={t.colors.text.secondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
