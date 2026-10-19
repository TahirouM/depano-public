import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { haptic } from '../utils/haptics';
import { Badge } from './Badge';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}

/** Onglets internes (ex. « En cours » / « Passées »). */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedControlProps<T>) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { backgroundColor: t.colors.background.subtle, borderRadius: t.radius.md, padding: t.spacing.xs }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.badge ? `${o.label}, ${o.badge}` : o.label}
            onPress={() => {
              if (!selected) haptic('selection');
              onChange(o.value);
            }}
            style={[
              styles.item,
              {
                minHeight: MIN_TOUCH - 8,
                borderRadius: t.radius.sm,
                backgroundColor: selected ? t.colors.background.surface : 'transparent',
              },
              selected && t.elevation(1),
            ]}
          >
            <Text variant="label" tone={selected ? 'primary' : 'secondary'}>
              {o.label}
            </Text>
            {o.badge ? <Badge count={o.badge} tone="urgent" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 4 },
  item: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
