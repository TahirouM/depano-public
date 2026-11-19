import { MAX_FONT_SCALE, Text, useTheme } from '@depano/ui';
import type { NativeStackNavigationOptions } from 'expo-router';
import { useMemo } from 'react';

/** Titre d'en-tête des maquettes : centré, en capitales, gras (lu normalement par VoiceOver/TalkBack). */
function HeaderTitle({ children }: { children: string }) {
  return (
    <Text
      variant="bodyStrong"
      weight="bold"
      numberOfLines={1}
      accessibilityRole="header"
      accessibilityLabel={children}
      maxFontSizeMultiplier={Math.min(1.4, MAX_FONT_SCALE)}
      style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}
    >
      {children}
    </Text>
  );
}

/** Options d'en-tête natives aux couleurs du thème (à passer à <Stack screenOptions>). */
export function useStackOptions(): NativeStackNavigationOptions {
  const t = useTheme();
  return useMemo<NativeStackNavigationOptions>(
    () => ({
      headerStyle: { backgroundColor: t.colors.background.canvas },
      headerTintColor: t.colors.text.primary,
      headerTitleAlign: 'center',
      headerTitle: ({ children }) => <HeaderTitle>{children}</HeaderTitle>,
      headerTitleStyle: { ...(t.fonts ? { fontFamily: t.fonts.bold } : { fontWeight: '700' }), color: t.colors.text.primary },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: t.colors.background.canvas },
      animation: 'default',
    }),
    [t],
  );
}
