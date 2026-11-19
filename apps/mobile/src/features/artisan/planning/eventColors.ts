import { EVENT_COLORS, type EventColor } from '@depano/schemas';
import type { Theme, Tone, ToneColors } from '@depano/ui';

/**
 * Couleurs des événements personnels du planning : chaque couleur API est rattachée à un ton du thème
 * (contrastes vérifiés en clair et en sombre) ; le violet, sans ton dédié, a sa propre paire.
 * La couleur n'est jamais le seul repère : le nom de la couleur est lu par VoiceOver / TalkBack.
 */
export const EVENT_COLOR_LABELS: Record<EventColor, string> = {
  green: 'Vert',
  blue: 'Bleu',
  red: 'Rouge',
  orange: 'Orange',
  purple: 'Violet',
  grey: 'Gris',
};

const TONE_OF: Record<Exclude<EventColor, 'purple'>, Tone> = {
  green: 'success',
  blue: 'info',
  red: 'danger',
  orange: 'warning',
  grey: 'neutral',
};

const PURPLE: Record<Theme['scheme'], ToneColors> = {
  light: { solid: '#6B3FA0', onSolid: '#FFFFFF', soft: '#F1EAF8', text: '#5B3590' },
  dark: { solid: '#C3A3F0', onSolid: '#1E0F33', soft: '#2C2238', text: '#CDB2F5' },
};

export function eventColor(
  color: EventColor | null | undefined,
  t: Pick<Theme, 'scheme' | 'colors'>,
): ToneColors {
  const c = color ?? 'blue';
  return c === 'purple' ? PURPLE[t.scheme] : t.colors.tone[TONE_OF[c]];
}

export { EVENT_COLORS };
