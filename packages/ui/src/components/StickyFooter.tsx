import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiquidGlass } from '../glass/useLiquidGlass';
import { useTheme } from '../theme/ThemeProvider';
import { Glass } from './Glass';

export interface StickyFooterProps {
  children: ReactNode;
  /** Écran situé dans un onglet (au-dessus de la tab bar). */
  aboveTabBar?: boolean;
  /** false : jamais de Liquid Glass (fond opaque), ex. contenu textuel dense. Défaut true. */
  glass?: boolean;
}

/**
 * Inset bas à appliquer sous un contenu collé en bas d'écran.
 * - iOS (tabs natives) : la tab bar flotte AU-DESSUS du contenu ; chaque onglet a son propre
 *   SafeAreaProvider dont `insets.bottom` inclut la hauteur de la tab bar → on l'applique.
 * - Android (tabs natives) : le contenu de l'onglet est déjà placé au-dessus de la tab bar → 0.
 * - Web (tab bar JS) : la tab bar est dans la mise en page et porte l'inset → 0.
 */
export function bottomInsetFor(aboveTabBar: boolean | undefined, insetBottom: number): number {
  if (!aboveTabBar) return insetBottom;
  return Platform.OS === 'ios' ? insetBottom : 0;
}

/**
 * CTA principal en bas d'écran, dans la zone du pouce.
 * iOS 26 : « dock » Liquid Glass posé sur le fond d'écran (le contenu ne défile pas dessous :
 * prix et mentions gardent un contraste stable). Ailleurs : barre opaque avec filet.
 */
export function StickyFooter({ children, aboveTabBar, glass = true }: StickyFooterProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const lg = useLiquidGlass();
  const bottom = bottomInsetFor(aboveTabBar, insets.bottom);

  if (glass && lg.enabled) {
    return (
      <View style={{ paddingHorizontal: t.spacing.sm, paddingTop: t.spacing.xs, paddingBottom: bottom + t.spacing.sm }}>
        <Glass legible radius={t.radius.lg} style={{ paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.md, gap: t.spacing.sm }}>
          {children}
        </Glass>
      </View>
    );
  }

  return (
    <View
      style={[
        {
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.md,
          paddingBottom: bottom + t.spacing.md,
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
