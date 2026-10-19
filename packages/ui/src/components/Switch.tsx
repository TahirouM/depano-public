import { Platform, Pressable, Switch as RNSwitch, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { haptic } from '../utils/haptics';
import { Text } from './Text';

export interface SwitchProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  testID?: string;
}

/** Interrupteur avec libellé ; toute la ligne est cliquable (≥ 48 px). */
export function Switch({ value, onValueChange, label, description, disabled, testID }: SwitchProps) {
  const t = useTheme();
  const toggle = () => {
    if (disabled) return;
    haptic('selection');
    onValueChange(!value);
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      onPress={toggle}
      style={[styles.row, { minHeight: MIN_TOUCH, paddingVertical: t.spacing.sm, gap: t.spacing.md }]}
    >
      <View style={styles.texts}>
        <Text variant="body" tone={disabled ? 'disabled' : 'primary'}>
          {label}
        </Text>
        {description ? (
          <Text variant="callout" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <RNSwitch
        value={value}
        onValueChange={toggle}
        disabled={disabled}
        accessibilityElementsHidden
        importantForAccessibility="no"
        trackColor={{ false: t.colors.border.input, true: t.colors.tone.success.solid }}
        thumbColor={Platform.OS === 'android' ? t.colors.background.surface : undefined}
        ios_backgroundColor={t.colors.border.input}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
});
