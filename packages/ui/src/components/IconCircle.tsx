import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type LucideIcon } from './Icon';

export interface IconCircleProps {
  icon: LucideIcon;
  /** Diamètre de la pastille (défaut 40). */
  size?: number;
  /** Couleurs explicites (ex. pastille métier) ; sinon beige pêche + encre. */
  colors?: { bg: string; fg: string };
  style?: StyleProp<ViewStyle>;
}

/** Icône posée dans une pastille ronde beige pêche (en-têtes de carte, domaines, jours). Décorative. */
export function IconCircle({ icon, size = 40, colors, style }: IconCircleProps) {
  const t = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors?.bg ?? t.colors.brand.surface,
        },
        style,
      ]}
    >
      <Icon icon={icon} size={Math.round(size * 0.5)} color={colors?.fg ?? t.colors.text.primary} strokeWidth={1.75} />
    </View>
  );
}
