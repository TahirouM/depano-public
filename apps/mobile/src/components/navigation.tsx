import { useTheme } from '@depano/ui';
import type { NativeStackNavigationOptions } from 'expo-router';
import { useMemo } from 'react';

/** Options d'en-tête natives aux couleurs du thème (à passer à <Stack screenOptions>). */
export function useStackOptions(): NativeStackNavigationOptions {
  const t = useTheme();
  return useMemo<NativeStackNavigationOptions>(
    () => ({
      headerStyle: { backgroundColor: t.colors.background.canvas },
      headerTintColor: t.colors.text.brand,
      headerTitleStyle: { ...(t.fonts ? { fontFamily: t.fonts.semibold } : { fontWeight: '600' }), color: t.colors.text.primary },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      contentStyle: { backgroundColor: t.colors.background.canvas },
      animation: 'default',
    }),
    [t],
  );
}
