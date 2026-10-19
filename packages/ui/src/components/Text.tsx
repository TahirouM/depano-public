import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { Tone } from '../tokens/colors';
import { MAX_FONT_SCALE, type FontWeightName, type TextVariant } from '../tokens/typography';

export type TextTone = 'primary' | 'secondary' | 'brand' | 'inverse' | 'disabled' | Tone;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: FontWeightName;
  align?: TextStyle['textAlign'];
  /** Couleur explicite (à éviter : préférer `tone`). */
  color?: string;
}

const TEXT_TONES = new Set(['primary', 'secondary', 'brand', 'inverse', 'disabled']);
const HEADINGS = new Set<TextVariant>(['display', 'title1', 'title2']);

/**
 * Texte DEPANO. Dynamic Type actif (jusqu'à 200 %), titres annoncés comme « en-tête ».
 */
export function Text({ variant = 'body', tone = 'primary', weight, align, color, style, ...rest }: TextProps) {
  const t = useTheme();
  const resolved =
    color ??
    (TEXT_TONES.has(tone) ? t.colors.text[tone as 'primary'] : t.colors.tone[tone as Tone].text);
  return (
    <RNText
      accessibilityRole={HEADINGS.has(variant) ? 'header' : undefined}
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[t.text(variant, weight), { color: resolved }, align ? { textAlign: align } : null, style]}
    />
  );
}
