import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export interface StickyFooterProps {
  children: ReactNode;
  /** Dans un onglet, la tab bar porte déjà l'inset bas. */
  aboveTabBar?: boolean;
}

/** CTA principal en bas d'écran, dans la zone du pouce. */
export function StickyFooter({ children, aboveTabBar }: StickyFooterProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.md,
          paddingBottom: (aboveTabBar ? 0 : insets.bottom) + t.spacing.md,
          backgroundColor: t.colors.background.surface,
          gap: t.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: t.colors.border.subtle,
        },
      ]}
    >
      {children}
    </View>
  );
}
