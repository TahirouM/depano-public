/** Grille de 4 px (plan, section 2). */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
export type SpacingToken = keyof typeof spacing;

/** Champs 12 / cartes et boutons 16 / sheets 24 / chips et créneaux plein. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  full: 999,
} as const;
export type RadiusToken = keyof typeof radius;

/** Cible tactile minimale (WCAG 2.5.8 / HIG / Material). */
export const MIN_TOUCH = 48;

/** Durées d'animation : sobres, 200 à 300 ms. */
export const motion = {
  fast: 200,
  base: 250,
  slow: 300,
} as const;
