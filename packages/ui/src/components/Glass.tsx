import { GlassContainer, GlassView } from 'expo-glass-effect';
import { StyleSheet, View, type ColorValue, type ViewProps } from 'react-native';
import { hexWithAlpha } from '../glass/support';
import { useLiquidGlass } from '../glass/useLiquidGlass';
import { useTheme } from '../theme/ThemeProvider';
import type { ElevationLevel } from '../tokens/elevation';

export interface GlassProps extends ViewProps {
  /** `regular` (dépoli, défaut) ou `clear` (très transparent : icônes seules, jamais de texte). */
  variant?: 'regular' | 'clear';
  /**
   * Du texte est posé sur le verre : la vitre est teintée avec la couleur de surface
   * pour garder un contraste lisible quel que soit le contenu dessous. Recommandé dès qu'il y a un libellé.
   */
  legible?: boolean;
  /** Teinte explicite (ignorée si `legible`). */
  tint?: ColorValue;
  /** Réaction native au toucher (boutons flottants). */
  interactive?: boolean;
  /** Rayon des coins (défaut : capsule). */
  radius?: number;
  /** Fond de la surface opaque de repli. */
  fallback?: 'surface' | 'canvas' | 'brand' | 'subtle';
  /** Élévation de la surface de repli (défaut 3 : élément flottant). */
  elevation?: ElevationLevel;
}

/**
 * Liquid Glass (iOS 26+) avec repli opaque.
 *
 * - iOS 26 + « Réduire la transparence » désactivé : `GlassView` natif, au schéma de couleurs de l'app.
 * - Sinon (web, Android, iOS < 26, transparence réduite) : surface opaque du thème + élévation + filet.
 *
 * Règles : uniquement des libellés courts et des icônes sur le verre ; le texte important reste sur
 * une surface pleine. Ne jamais animer l'opacité du verre ou de ses parents (Apple) ; les boutons
 * rouges d'urgence ne sont jamais en verre.
 */
export function Glass({ variant = 'regular', legible, tint, interactive, radius, fallback = 'surface', elevation = 3, style, children, ...rest }: GlassProps) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const borderRadius = radius ?? t.radius.full;
  if (glass.enabled) {
    return (
      <GlassView
        {...rest}
        glassEffectStyle={variant}
        colorScheme={t.scheme}
        tintColor={legible ? hexWithAlpha(t.colors.background.surface, t.scheme === 'light' ? 0.55 : 0.5) : tint}
        isInteractive={interactive}
        style={[{ borderRadius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View
      {...rest}
      style={[
        {
          borderRadius,
          backgroundColor: t.colors.background[fallback],
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border.subtle,
        },
        t.elevation(elevation),
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface GlassGroupProps extends ViewProps {
  /** Distance à partir de laquelle les éléments de verre fusionnent. */
  spacing?: number;
}

/** Regroupe plusieurs `Glass` proches pour qu'ils se mêlent (GlassContainer) ; simple View en repli. */
export function GlassGroup({ spacing, ...rest }: GlassGroupProps) {
  const glass = useLiquidGlass();
  if (glass.enabled) return <GlassContainer spacing={spacing} {...rest} />;
  return <View {...rest} />;
}
