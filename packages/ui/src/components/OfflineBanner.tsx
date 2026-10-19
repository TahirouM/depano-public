import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { CloudOff } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export interface OfflineBannerProps {
  visible: boolean;
  /** Actions mises en file (envoyées au retour du réseau). */
  pendingCount?: number;
}

export function OfflineBanner({ visible, pendingCount = 0 }: OfflineBannerProps) {
  const t = useTheme();
  if (!visible) return null;
  const msg =
    pendingCount > 0
      ? `Hors ligne · ${pendingCount} action${pendingCount > 1 ? 's' : ''} en attente, envoyée${pendingCount > 1 ? 's' : ''} au retour du réseau`
      : 'Hors ligne · vous consultez les dernières informations chargées';
  return (
    <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={msg}
        style={[styles.row, { backgroundColor: t.colors.tone.warning.soft, paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm, gap: t.spacing.sm }]}
      >
        <Icon icon={CloudOff} size={18} color={t.colors.tone.warning.text} />
        <Text variant="callout" tone="warning" style={styles.flex}>
          {msg}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
