import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { Tone } from '../tokens/colors';
import { MIN_TOUCH } from '../tokens/scale';
import { haptic } from '../utils/haptics';
import { Icon, type LucideIcon } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Chip de filtre : coche visible quand sélectionné (pas la couleur seule). */
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
  accessibilityLabel?: string;
  testID?: string;
  /** Couleurs explicites (DomainChip). */
  colors?: { bg: string; fg: string; border?: string };
}

export function Chip({ label, icon, tone = 'neutral', selected, onPress, size = 'md', accessibilityLabel, testID, colors }: ChipProps) {
  const t = useTheme();
  const toneC = t.colors.tone[tone];
  const bg = selected ? t.colors.brand.primary : colors?.bg ?? toneC.soft;
  const fg = selected ? t.colors.brand.onPrimary : colors?.fg ?? toneC.text;
  const border = selected ? t.colors.brand.primary : colors?.border ?? (tone === 'brand' || tone === 'neutral' ? t.colors.brand.outline : toneC.soft);
  const body = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          borderRadius: t.radius.full,
          paddingHorizontal: size === 'sm' ? t.spacing.sm : t.spacing.md,
          minHeight: size === 'sm' ? 28 : 36,
        },
      ]}
    >
      {selected ? <Icon icon={Check} size={16} color={fg} /> : icon ? <Icon icon={icon} size={size === 'sm' ? 14 : 16} color={fg} /> : null}
      <Text variant={size === 'sm' ? 'caption' : 'label'} weight="semibold" color={fg}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel ?? label} testID={testID} style={styles.self}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      style={({ pressed }) => [styles.touch, { minHeight: MIN_TOUCH, opacity: pressed ? 0.8 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  touch: { justifyContent: 'center', alignSelf: 'flex-start' },
  self: { alignSelf: 'flex-start' },
});
