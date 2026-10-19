/**
 * Couleurs DEPANO (plan, section 2). On n'utilise JAMAIS ces palettes brutes dans les écrans :
 * passer par `useTheme().colors` (tokens sémantiques), qui gère le mode sombre et l'accent artisan.
 */
import type { DomainCode } from '@depano/schemas';

export type ColorScheme = 'light' | 'dark';
/** Accent de l'espace actif : client (brun sable) ou artisan (ardoise). */
export type Accent = 'client' | 'artisan';

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'urgent';

export interface ToneColors {
  /** Remplissage plein (bouton, pastille pleine, icône). */
  solid: string;
  /** Texte/icône posé sur `solid`. */
  onSolid: string;
  /** Fond teinté (chips, bannières). */
  soft: string;
  /** Texte/icône lisible sur `soft` ET sur les surfaces (≥ 4,5:1). */
  text: string;
}

export type DomainColors = ToneColors;

export interface ThemeColors {
  background: {
    /** Fond d'écran. */
    canvas: string;
    /** Cartes, sheets, tab bar. */
    surface: string;
    /** Fond de section « marque » (beige), cartes artisans. */
    brand: string;
    /** Fond discret (champs, skeletons, lignes alternées). */
    subtle: string;
    /** Voile derrière les sheets / modales. */
    scrim: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    /** Liens et texte de marque. */
    brand: string;
    inverse: string;
    /** Texte désactivé (exempté de contraste, toujours doublé d'un état accessible). */
    disabled: string;
  };
  border: {
    subtle: string;
    /** Bordure de champ : ≥ 3:1 sur la surface (WCAG 1.4.11). */
    input: string;
    focus: string;
  };
  brand: {
    primary: string;
    primaryPressed: string;
    onPrimary: string;
    /** Beige #F1E4D3 en clair. */
    surface: string;
  };
  tone: Record<Tone, ToneColors>;
  domain: Record<DomainCode, DomainColors>;
  /** Squelettes de chargement. */
  skeleton: string;
  /** Couleur des ombres (élévation). */
  shadow: string;
}

/* ------------------------------------------------------------------ */
/* Palettes de base                                                    */
/* ------------------------------------------------------------------ */

const light = {
  canvas: '#FCFAF7',
  surface: '#FFFFFF',
  beige: '#F1E4D3',
  subtle: '#F4EEE6',
  ink: '#2A2118',
  inkSecondary: '#6B5D4F',
  border: '#E6DCCF',
  borderInput: '#8F7E6C',
};

const dark = {
  canvas: '#16120E',
  surface: '#1F1A15',
  beige: '#2E261E',
  subtle: '#29221B',
  ink: '#F3ECE3',
  inkSecondary: '#BFB2A3',
  border: '#3A3128',
  borderInput: '#8A7B6B',
};

const lightTones: Record<Tone, ToneColors> = {
  neutral: { solid: '#4F4337', onSolid: '#FFFFFF', soft: '#EFE8DF', text: '#4F4337' },
  brand: { solid: '#8A6A4A', onSolid: '#FFFFFF', soft: '#F1E4D3', text: '#6E5238' },
  info: { solid: '#1F5FBF', onSolid: '#FFFFFF', soft: '#E6EEFA', text: '#1A4F9E' },
  success: { solid: '#1E7F4F', onSolid: '#FFFFFF', soft: '#E3F3EA', text: '#17663F' },
  // Ambre #B26B00 : réservé aux icônes / remplissages ; le texte utilise une teinte plus sombre.
  warning: { solid: '#B26B00', onSolid: '#000000', soft: '#FFF3E0', text: '#8A5300' },
  danger: { solid: '#B42318', onSolid: '#FFFFFF', soft: '#FDECEA', text: '#B42318' },
  // Rouge urgence : bouton et parcours urgence uniquement.
  urgent: { solid: '#C8102E', onSolid: '#FFFFFF', soft: '#FDE8EB', text: '#B00E28' },
};

const darkTones: Record<Tone, ToneColors> = {
  neutral: { solid: '#D8CCBE', onSolid: '#1D160F', soft: '#2F2820', text: '#D8CCBE' },
  brand: { solid: '#D1AD86', onSolid: '#1D160F', soft: '#3A2F24', text: '#D9B892' },
  info: { solid: '#6FA2FF', onSolid: '#0B1A33', soft: '#15253D', text: '#8DB6FF' },
  success: { solid: '#4CC28A', onSolid: '#06210F', soft: '#12301F', text: '#6FD3A2' },
  warning: { solid: '#F0A83C', onSolid: '#241500', soft: '#3A2A10', text: '#F5BD66' },
  danger: { solid: '#FF8A80', onSolid: '#2A0703', soft: '#3B1512', text: '#FF9C93' },
  // Le bouton urgence reste rouge DEPANO en sombre (texte blanc 5,9:1).
  urgent: { solid: '#C8102E', onSolid: '#FFFFFF', soft: '#3D1219', text: '#FF8A99' },
};

const lightDomains: Record<DomainCode, DomainColors> = {
  plomberie: { solid: '#1F5FBF', onSolid: '#FFFFFF', soft: '#E6EEFA', text: '#1A4F9E' },
  electricite: { solid: '#F2C94C', onSolid: '#2A2118', soft: '#FDF6DD', text: '#6E5300' },
  energetique: { solid: '#D9661F', onSolid: '#1F0E02', soft: '#FCEBDD', text: '#9A4410' },
};

const darkDomains: Record<DomainCode, DomainColors> = {
  plomberie: { solid: '#6FA2FF', onSolid: '#0B1A33', soft: '#15253D', text: '#8DB6FF' },
  electricite: { solid: '#F2C94C', onSolid: '#2A2118', soft: '#332A0E', text: '#F2C94C' },
  energetique: { solid: '#F2994A', onSolid: '#2A1405', soft: '#3A2312', text: '#F5AC6B' },
};

/** Accent par espace : remplace brand.* et tone.brand. */
const accents: Record<Accent, Record<ColorScheme, { primary: string; pressed: string; onPrimary: string; surface: string; text: string; soft: string }>> = {
  client: {
    light: { primary: '#8A6A4A', pressed: '#74583D', onPrimary: '#FFFFFF', surface: '#F1E4D3', text: '#6E5238', soft: '#F1E4D3' },
    dark: { primary: '#D1AD86', pressed: '#BF9A72', onPrimary: '#1D160F', surface: '#2E261E', text: '#D9B892', soft: '#3A2F24' },
  },
  artisan: {
    light: { primary: '#3B4A5A', pressed: '#2C3845', onPrimary: '#FFFFFF', surface: '#E3E8EE', text: '#3B4A5A', soft: '#E3E8EE' },
    dark: { primary: '#A9BCCF', pressed: '#93A8BD', onPrimary: '#0F1720', surface: '#1E252D', text: '#B4C6D8', soft: '#26303A' },
  },
};

export function buildColors(scheme: ColorScheme, accent: Accent = 'client'): ThemeColors {
  const p = scheme === 'light' ? light : dark;
  const tones = scheme === 'light' ? lightTones : darkTones;
  const a = accents[accent][scheme];
  return {
    background: {
      canvas: p.canvas,
      surface: p.surface,
      brand: a.surface,
      subtle: p.subtle,
      scrim: scheme === 'light' ? 'rgba(42,33,24,0.45)' : 'rgba(0,0,0,0.6)',
      inverse: p.ink,
    },
    text: {
      primary: p.ink,
      secondary: p.inkSecondary,
      brand: a.text,
      inverse: p.canvas,
      disabled: scheme === 'light' ? '#A89A8B' : '#6E6255',
    },
    border: {
      subtle: p.border,
      input: p.borderInput,
      focus: a.primary,
    },
    brand: {
      primary: a.primary,
      primaryPressed: a.pressed,
      onPrimary: a.onPrimary,
      surface: a.surface,
    },
    tone: {
      ...tones,
      brand: { solid: a.primary, onSolid: a.onPrimary, soft: a.soft, text: a.text },
    },
    domain: scheme === 'light' ? lightDomains : darkDomains,
    skeleton: scheme === 'light' ? '#EDE5DA' : '#2C251E',
    shadow: scheme === 'light' ? 'rgba(42,33,24,0.14)' : 'rgba(0,0,0,0.5)',
  };
}

/** Valeurs brutes du plan, exposées pour la doc et les tests. */
export const RAW = {
  brandPrimary: '#8A6A4A',
  brandSurface: '#F1E4D3',
  urgent: '#C8102E',
  success: '#1E7F4F',
  warning: '#B26B00',
  info: '#1F5FBF',
} as const;
