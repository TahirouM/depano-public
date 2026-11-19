import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { SpacingToken } from '../tokens/scale';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** surface (blanc, bordure fine + ombre douce), brand (beige pêche), outline (bordure fine), flat. */
  variant?: 'surface' | 'brand' | 'outline' | 'flat';
  padding?: SpacingToken;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ children, onPress, variant = 'surface', padding = 'lg', accessibilityLabel, accessibilityHint, style, testID }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    borderRadius: t.radius.md,
    padding: t.spacing[padding],
    backgroundColor:
      variant === 'brand' ? t.colors.background.brand : variant === 'flat' ? t.colors.background.subtle : t.colors.background.surface,
    ...(variant === 'surface' ? t.elevation(1) : null),
    ...(variant === 'surface' || variant === 'outline' ? { borderWidth: 1, borderColor: t.colors.border.subtle } : null),
    ...(variant === 'brand' ? { borderWidth: 1, borderColor: t.colors.brand.outline } : null),
  };
  if (!onPress) {
    return (
      <View testID={testID} style={[base, style]} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}
    >
      {children}
    </Pressable>
  );
}
