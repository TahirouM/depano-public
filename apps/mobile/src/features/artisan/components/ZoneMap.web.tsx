import { Text, useTheme } from '@depano/ui';
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { ZoneMapProps } from './ZoneMap';

/** Web : react-native-maps n'existe pas, on dessine un schéma du rayon (échelle 50 km). */
export function ZoneMap({ radiusKm, height = 220 }: ZoneMapProps) {
  const t = useTheme();
  const size = height;
  const max = (size / 2) * 0.92;
  const r = Math.max(8, (radiusKm / 50) * max);
  return (
    <View
      style={{
        height,
        borderRadius: t.radius.md,
        overflow: 'hidden',
        backgroundColor: t.colors.background.subtle,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible
      accessibilityLabel={`Schéma : zone d'intervention de ${radiusKm} kilomètres autour de votre point de départ`}
    >
      <Svg width={size} height={size}>
        {[10, 20, 30, 40, 50].map((km) => (
          <Circle
            key={km}
            cx={size / 2}
            cy={size / 2}
            r={(km / 50) * max}
            stroke={t.colors.border.subtle}
            strokeWidth={1}
            fill="none"
          />
        ))}
        <Line
          x1={0}
          y1={size / 2}
          x2={size}
          y2={size / 2}
          stroke={t.colors.border.subtle}
          strokeWidth={1}
        />
        <Line
          x1={size / 2}
          y1={0}
          x2={size / 2}
          y2={size}
          stroke={t.colors.border.subtle}
          strokeWidth={1}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.colors.brand.primary}
          strokeWidth={2}
          fill={t.colors.tone.brand.soft}
          fillOpacity={0.7}
        />
        <Circle cx={size / 2} cy={size / 2} r={6} fill={t.colors.brand.primary} />
      </Svg>
      <Text
        variant="caption"
        tone="secondary"
        style={{ position: 'absolute', bottom: 8, right: 12 }}
      >
        {radiusKm} km
      </Text>
    </View>
  );
}
