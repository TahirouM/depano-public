/** Écrans où la tab bar est masquée (chat : le clavier a besoin de place). Partagé web (JS) / natif. */
export const isTabBarHiddenOn = (segments: string[]): boolean => segments.includes('messages') && segments[segments.length - 1] === '[id]';

/** Texte d'un badge d'onglet (tab bar native : chaîne ; 99+ au-delà). */
export const tabBadgeText = (n: number): string => (n > 99 ? '99+' : String(n));

/** Libellé lu par VoiceOver/TalkBack pour un onglet avec badge (jamais la couleur seule). */
export const tabAccessibilityLabel = (label: string, count: number): string => (count ? `${label}, ${count} non lu${count > 1 ? 's' : ''}` : label);
