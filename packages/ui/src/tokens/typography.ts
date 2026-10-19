import type { TextStyle } from 'react-native';

/** Échelle 12 / 14 / 16 (corps) / 20 / 24 / 32. */
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold';

/** Familles Inter chargées par l'app (expo-font). `null` = police système (SF Pro / Roboto). */
export type FontFamilies = Record<FontWeightName, string> | null;

export const INTER_FAMILIES: Record<FontWeightName, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const weightValue: Record<FontWeightName, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const TEXT_VARIANTS = {
  display: { size: fontSize.xxl, lineHeight: 40, weight: 'bold' },
  title1: { size: fontSize.xl, lineHeight: 32, weight: 'bold' },
  title2: { size: fontSize.lg, lineHeight: 28, weight: 'semibold' },
  body: { size: fontSize.md, lineHeight: 24, weight: 'regular' },
  bodyStrong: { size: fontSize.md, lineHeight: 24, weight: 'semibold' },
  callout: { size: fontSize.sm, lineHeight: 20, weight: 'regular' },
  label: { size: fontSize.sm, lineHeight: 20, weight: 'semibold' },
  caption: { size: fontSize.xs, lineHeight: 16, weight: 'regular' },
  overline: { size: fontSize.xs, lineHeight: 16, weight: 'semibold' },
} as const satisfies Record<string, { size: number; lineHeight: number; weight: FontWeightName }>;

export type TextVariant = keyof typeof TEXT_VARIANTS;

/** Style RN d'un variant. Avec Inter, le poids passe par la famille (Android ignore fontWeight). */
export function textStyle(variant: TextVariant, fonts: FontFamilies, weight?: FontWeightName): TextStyle {
  const v = TEXT_VARIANTS[variant];
  const w = weight ?? v.weight;
  return {
    fontSize: v.size,
    lineHeight: v.lineHeight,
    ...(fonts ? { fontFamily: fonts[w] } : { fontWeight: weightValue[w] }),
    ...(variant === 'overline' ? { textTransform: 'uppercase', letterSpacing: 0.6 } : null),
  };
}

/** Dynamic Type autorisé jusqu'à 200 %. */
export const MAX_FONT_SCALE = 2;
