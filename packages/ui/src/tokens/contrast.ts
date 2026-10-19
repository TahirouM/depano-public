import { buildColors, type Accent, type ColorScheme } from './colors';
import { DOMAIN_CODES } from '@depano/schemas';

/** Luminance relative WCAG 2.x d'une couleur #RRGGBB. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface ContrastPair {
  name: string;
  fg: string;
  bg: string;
  /** 4,5 pour le texte, 3 pour les composants non textuels (bordures de champ). */
  min: number;
}

/** Toutes les paires texte/fond utilisées par le design system, pour un thème donné. */
export function contrastPairs(scheme: ColorScheme, accent: Accent): ContrastPair[] {
  const c = buildColors(scheme, accent);
  const pairs: ContrastPair[] = [];
  const surfaces = {
    canvas: c.background.canvas,
    surface: c.background.surface,
    brand: c.background.brand,
    subtle: c.background.subtle,
  };
  for (const [sName, bg] of Object.entries(surfaces)) {
    pairs.push({ name: `text.primary/${sName}`, fg: c.text.primary, bg, min: 4.5 });
    pairs.push({ name: `text.secondary/${sName}`, fg: c.text.secondary, bg, min: 4.5 });
    pairs.push({ name: `text.brand/${sName}`, fg: c.text.brand, bg, min: 4.5 });
  }
  pairs.push({ name: 'text.inverse/background.inverse', fg: c.text.inverse, bg: c.background.inverse, min: 4.5 });
  pairs.push({ name: 'onPrimary/primary', fg: c.brand.onPrimary, bg: c.brand.primary, min: 4.5 });
  pairs.push({ name: 'onPrimary/primaryPressed', fg: c.brand.onPrimary, bg: c.brand.primaryPressed, min: 4.5 });
  for (const [tName, t] of Object.entries(c.tone)) {
    pairs.push({ name: `tone.${tName}.onSolid/solid`, fg: t.onSolid, bg: t.solid, min: 4.5 });
    pairs.push({ name: `tone.${tName}.text/soft`, fg: t.text, bg: t.soft, min: 4.5 });
    pairs.push({ name: `tone.${tName}.text/surface`, fg: t.text, bg: c.background.surface, min: 4.5 });
    pairs.push({ name: `tone.${tName}.text/canvas`, fg: t.text, bg: c.background.canvas, min: 4.5 });
  }
  for (const d of DOMAIN_CODES) {
    const t = c.domain[d];
    pairs.push({ name: `domain.${d}.onSolid/solid`, fg: t.onSolid, bg: t.solid, min: 4.5 });
    pairs.push({ name: `domain.${d}.text/soft`, fg: t.text, bg: t.soft, min: 4.5 });
    pairs.push({ name: `domain.${d}.text/surface`, fg: t.text, bg: c.background.surface, min: 4.5 });
  }
  pairs.push({ name: 'border.input/surface', fg: c.border.input, bg: c.background.surface, min: 3 });
  pairs.push({ name: 'border.input/canvas', fg: c.border.input, bg: c.background.canvas, min: 3 });
  pairs.push({ name: 'border.focus/surface', fg: c.border.focus, bg: c.background.surface, min: 3 });
  return pairs;
}
