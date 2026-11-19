/**
 * Couleurs DEPANO (plan, section 2). On n'utilise JAMAIS ces palettes brutes dans les écrans :
 * passer par `useTheme().colors` (tokens sémantiques), qui gère le mode sombre et l'accent artisan.
 */
import type { DomainCode } from '@depano/schemas';

export type ColorScheme = 'light' | 'dark';
/** Espace actif (client / artisan) ; même habillage pour les deux depuis la refonte « maquettes ». */
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
    /** Beige pêche #F3E7DA en clair (pastilles d'icône, boutons secondaires). */
    surface: string;
    /** Bordure des éléments beige (bouton secondaire, chips de domaine). */
    outline: string;
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
  canvas: '#F8F4EF',
  surface: '#FFFFFF',
  beige: '#F3E7DA',
  subtle: '#F4EFE9',
  ink: '#1E2124',
  inkSecondary: '#625C56',
  border: '#ECE4DA',
  borderInput: '#8C8178',
};

const dark = {
  canvas: '#141210',
  surface: '#1E1B18',
  beige: '#2E2720',
  subtle: '#282420',
  ink: '#F5F0EA',
  inkSecondary: '#BDB3A8',
  border: '#36302A',
  borderInput: '#8A7F74',
};

const lightTones: Record<Tone, ToneColors> = {
  neutral: { solid: '#3E3934', onSolid: '#FFFFFF', soft: '#F1ECE6', text: '#3E3934' },
  brand: { solid: '#1E2124', onSolid: '#FFFFFF', soft: '#F3E7DA', text: '#7A5534' },
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

type AccentColors = { primary: string; pressed: string; onPrimary: string; surface: string; text: string; soft: string; outline: string };

/**
 * Style DEPANO : CTA noir, surfaces beige pêche, texte de marque brun. Client et artisan partagent
 * le même habillage (l'espace se distingue par ses onglets, pas par sa couleur).
 */
const sharedAccent: Record<ColorScheme, AccentColors> = {
  light: { primary: '#1E2124', pressed: '#000000', onPrimary: '#FFFFFF', surface: '#F3E7DA', text: '#7A5534', soft: '#F3E7DA', outline: '#E3CFB9' },
  dark: { primary: '#F5F0EA', pressed: '#D9D1C7', onPrimary: '#141210', surface: '#2E2720', text: '#E0BE98', soft: '#3A3027', outline: '#4A3E33' },
};

/** Accent par espace : remplace brand.* et tone.brand. */
const accents: Record<Accent, Record<ColorScheme, AccentColors>> = {
  client: sharedAccent,
  artisan: sharedAccent,
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
      scrim: scheme === 'light' ? 'rgba(30,33,36,0.45)' : 'rgba(0,0,0,0.6)',
      inverse: p.ink,
    },
    text: {
      primary: p.ink,
      secondary: p.inkSecondary,
      brand: a.text,
      inverse: p.canvas,
      disabled: scheme === 'light' ? '#A79E95' : '#6E655C',
    },
    border: {
      subtle: p.border,
      input: p.borderInput,
      focus: a.text,
    },
    brand: {
      primary: a.primary,
      primaryPressed: a.pressed,
      onPrimary: a.onPrimary,
      surface: a.surface,
      outline: a.outline,
    },
    tone: {
      ...tones,
      brand: { solid: a.primary, onSolid: a.onPrimary, soft: a.soft, text: a.text },
    },
    domain: scheme === 'light' ? lightDomains : darkDomains,
    skeleton: scheme === 'light' ? '#EFE8E0' : '#2A2521',
    shadow: scheme === 'light' ? 'rgba(60,45,30,0.10)' : 'rgba(0,0,0,0.5)',
  };
}

/** Valeurs brutes du plan, exposées pour la doc et les tests. */
export const RAW = {
  brandPrimary: '#1E2124',
  brandSurface: '#F3E7DA',
  urgent: '#C8102E',
  success: '#1E7F4F',
  warning: '#B26B00',
  info: '#1F5FBF',
} as const;
