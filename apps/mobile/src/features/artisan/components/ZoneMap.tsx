import { Glass, Text, useTheme } from '@depano/ui';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

export interface ZoneMapProps {
  lat: number;
  lng: number;
  radiusKm: number;
  height?: number;
}

/** Carte de la zone d'intervention : point de départ + cercle du rayon (Apple Maps / Google Maps). */
export function ZoneMap({ lat, lng, radiusKm, height = 220 }: ZoneMapProps) {
  const t = useTheme();
  const delta = (radiusKm / 111) * 2.6;
  return (
    <View
      style={{
        height,
        borderRadius: t.radius.md,
        overflow: 'hidden',
        backgroundColor: t.colors.background.subtle,
      }}
      accessible
      accessibilityLabel={`Carte : zone d'intervention de ${radiusKm} kilomètres autour de votre point de départ`}
    >
      <MapView
        style={{ flex: 1 }}
        region={{ latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} />
        <Circle
          center={{ latitude: lat, longitude: lng }}
          radius={radiusKm * 1000}
          strokeColor={t.colors.brand.primary}
          strokeWidth={2}
          fillColor={`${t.colors.brand.primary}22`}
        />
      </MapView>
      {/* Rayon en capsule Liquid Glass (iOS 26 ; opaque ailleurs) — déjà lu dans le libellé de la carte. */}
      <View style={{ position: 'absolute', top: t.spacing.sm, left: t.spacing.sm }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Glass legible style={{ minHeight: 32, paddingHorizontal: t.spacing.md, justifyContent: 'center' }}>
          <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.5}>
            Rayon {radiusKm} km
          </Text>
        </Glass>
      </View>
    </View>
  );
}
