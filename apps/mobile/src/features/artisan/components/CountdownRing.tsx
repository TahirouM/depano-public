import { Text, useTheme } from '@depano/ui';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface CountdownRingProps {
  /** Secondes restantes. */
  remaining: number;
  total: number;
  size?: number;
}

/**
 * Anneau de compte à rebours (60 s pour accepter une urgence). Le chiffre est toujours
 * affiché : l'information ne repose pas sur la couleur ni sur l'animation.
 */
export function CountdownRing({ remaining, total, size = 132 }: CountdownRingProps) {
  const t = useTheme();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, remaining / total));
  const low = remaining <= 10;
  const color = low ? t.colors.tone.urgent.solid : t.colors.brand.primary;
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${remaining} secondes pour répondre`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.colors.border.subtle}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="display" tone={low ? 'urgent' : 'primary'} maxFontSizeMultiplier={1.4}>
        {remaining}
      </Text>
      <Text variant="caption" tone="secondary" maxFontSizeMultiplier={1.4}>
        secondes
      </Text>
    </View>
  );
}
