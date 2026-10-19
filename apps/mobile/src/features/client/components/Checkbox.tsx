import { Icon, Text, useTheme } from '@depano/ui';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  error?: string | null;
  testID?: string;
}

/** Case à cocher pleine ligne (≥ 48 px), état annoncé et visible (coche, pas la couleur seule). */
export function Checkbox({ checked, onChange, label, description, error, testID }: CheckboxProps) {
  const t = useTheme();
  const border = error ? t.colors.tone.danger.solid : checked ? t.colors.brand.primary : t.colors.border.input;
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: t.spacing.md,
        alignItems: 'flex-start',
        minHeight: 48,
        paddingVertical: t.spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          marginTop: 2,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: border,
          backgroundColor: checked ? t.colors.brand.primary : t.colors.background.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon icon={Check} size={18} color={t.colors.brand.onPrimary} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="callout" tone="secondary">
            {description}
          </Text>
        ) : null}
        {error ? (
          <Text variant="callout" tone="danger">
            {error}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
