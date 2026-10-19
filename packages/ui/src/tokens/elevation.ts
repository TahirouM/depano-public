import type { ViewStyle } from 'react-native';
import type { ColorScheme } from './colors';

/** 0 / 1 (cartes) / 3 (sheets). Pas de bordures noires épaisses. */
export type ElevationLevel = 0 | 1 | 3;

export function elevation(level: ElevationLevel, scheme: ColorScheme): ViewStyle {
  if (level === 0) return {};
  const a = scheme === 'light' ? (level === 1 ? 0.1 : 0.18) : level === 1 ? 0.4 : 0.6;
  const shadow = level === 1 ? `0px 1px 3px rgba(42, 33, 24, ${a})` : `0px 8px 24px rgba(42, 33, 24, ${a})`;
  return {
    boxShadow: scheme === 'light' ? shadow : shadow.replace('42, 33, 24', '0, 0, 0'),
  };
}
