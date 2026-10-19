import { Text, useTheme } from '@depano/ui';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Valeur lisible (ex. « 1 240,00 € ») pour l'accessibilité et l'étiquette. */
  display: string;
}

/**
 * Histogramme simple (CA par mois). Une seule couleur, valeurs écrites au-dessus de la
 * dernière barre et lisibles par VoiceOver/TalkBack pour chaque mois.
 */
export function BarChart({ bars, height = 180 }: { bars: Bar[]; height?: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const gap = 8;
  const bw = bars.length ? Math.max(8, (width - gap * (bars.length - 1)) / bars.length) : 0;
  const top = 4;
  const plot = height - top;
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Chiffre d'affaires par mois : ${bars.map((b) => `${b.label} ${b.display}`).join(', ')}`}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={0}
            y1={height - 0.5}
            x2={width}
            y2={height - 0.5}
            stroke={t.colors.border.subtle}
            strokeWidth={1}
          />
          {bars.map((b, i) => {
            const h = b.value > 0 ? Math.max(3, (b.value / max) * (plot - 4)) : 0;
            const last = i === bars.length - 1;
            return (
              <Rect
                key={b.key}
                x={i * (bw + gap)}
                y={height - h}
                width={bw}
                height={h}
                rx={4}
                fill={t.colors.brand.primary}
                opacity={last ? 1 : 0.55}
              />
            );
          })}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}
      <View
        style={{ flexDirection: 'row', gap, marginTop: t.spacing.xs }}
        importantForAccessibility="no-hide-descendants"
      >
        {bars.map((b) => (
          <Text
            key={b.key}
            variant="caption"
            tone="secondary"
            align="center"
            style={{ width: bw }}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
