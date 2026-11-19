import { Text, useTheme } from '@depano/ui';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

/** Ligne de la maquette : « Libellé : valeur › » (touchable si `onPress`). */
export function FormRow({
  label,
  value,
  onPress,
  hint,
  testID,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  hint?: string;
  testID?: string;
}) {
  const t = useTheme();
  const content = (
    <>
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {label}
        {value ? ' :' : ''}
      </Text>
      {value ? <Text variant="bodyStrong">{value}</Text> : null}
      {onPress ? <ChevronRight size={20} color={t.colors.text.secondary} /> : null}
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.sm,
    minHeight: 56,
    paddingHorizontal: t.spacing.lg,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.background.surface,
    borderWidth: 1,
    borderColor: t.colors.border.subtle,
  };
  if (!onPress)
    return (
      <View
        style={style}
        accessible
        accessibilityLabel={`${label}${value ? ` : ${value}` : ''}`}
        testID={testID}
      >
        {content}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? ` : ${value}` : ''}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}
