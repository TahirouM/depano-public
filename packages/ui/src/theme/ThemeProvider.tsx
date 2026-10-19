import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { buildColors, type Accent, type ColorScheme, type ThemeColors } from '../tokens/colors';
import { elevation, type ElevationLevel } from '../tokens/elevation';
import { motion, radius, spacing } from '../tokens/scale';
import { textStyle, type FontFamilies, type FontWeightName, type TextVariant } from '../tokens/typography';

export type SchemePreference = ColorScheme | 'system';

export interface Theme {
  scheme: ColorScheme;
  accent: Accent;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  fonts: FontFamilies;
  text: (variant: TextVariant, weight?: FontWeightName) => ReturnType<typeof textStyle>;
  elevation: (level: ElevationLevel) => ReturnType<typeof elevation>;
}

export function createTheme(scheme: ColorScheme, accent: Accent = 'client', fonts: FontFamilies = null): Theme {
  return {
    scheme,
    accent,
    colors: buildColors(scheme, accent),
    spacing,
    radius,
    motion,
    fonts,
    text: (variant, weight) => textStyle(variant, fonts, weight),
    elevation: (level) => elevation(level, scheme),
  };
}

const ThemeContext = createContext<Theme>(createTheme('light'));

export interface ThemeProviderProps {
  children: ReactNode;
  /** 'system' suit le réglage du téléphone ; clair par défaut. */
  scheme?: SchemePreference;
  /** Accent de l'espace actif (client / artisan). */
  accent?: Accent;
  /** Familles Inter si chargées, sinon police système. */
  fonts?: FontFamilies;
}

export function ThemeProvider({ children, scheme = 'light', accent = 'client', fonts = null }: ThemeProviderProps) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme === 'system' ? (system === 'dark' ? 'dark' : 'light') : scheme;
  const theme = useMemo(() => createTheme(resolved, accent, fonts), [resolved, accent, fonts]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Thème courant : couleurs sémantiques, échelles, styles de texte. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Force un accent pour un sous-arbre (ex. aperçu « vu client » dans l'espace artisan). */
export function AccentScope({ accent, children }: { accent: Accent; children: ReactNode }) {
  const parent = useTheme();
  const theme = useMemo(() => createTheme(parent.scheme, accent, parent.fonts), [parent.scheme, parent.fonts, accent]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
