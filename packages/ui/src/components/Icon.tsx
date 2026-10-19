import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type { LucideIcon };

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Icône décorative (masquée aux lecteurs d'écran : le libellé porte le sens). */
export function Icon({ icon: Glyph, size = 24, color, strokeWidth = 2 }: IconProps) {
  const t = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Glyph size={size} color={color ?? t.colors.text.primary} strokeWidth={strokeWidth} />
    </View>
  );
}
