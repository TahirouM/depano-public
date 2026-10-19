import { useTheme } from '@depano/ui';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { LiveMapProps } from './types';

/** Carte native (Apple Plans / Google Maps) : adresse, artisan en direct, rayon de recherche. */
export function LiveMap({ center, destination, artisan, artisanName, radiusKm, height = 260, accessibilityLabel }: LiveMapProps) {
  const t = useTheme();
  const ref = useRef<MapView>(null);
  const span = radiusKm ? (radiusKm / 111) * 2.4 : 0.03;

  useEffect(() => {
    const pts = [destination, artisan].filter(Boolean) as { lat: number; lng: number }[];
    if (pts.length < 2) return;
    ref.current?.fitToCoordinates(
      pts.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: true },
    );
  }, [destination, artisan]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ height, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.colors.background.subtle }}
    >
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: span, longitudeDelta: span }}
        showsUserLocation={!artisan}
        pitchEnabled={false}
        toolbarEnabled={false}
        userInterfaceStyle={t.scheme}
      >
        {radiusKm ? (
          <Circle
            center={{ latitude: center.lat, longitude: center.lng }}
            radius={radiusKm * 1000}
            strokeColor={t.colors.brand.primary}
            fillColor={t.colors.tone.brand.soft + '55'}
          />
        ) : null}
        {destination ? (
          <Marker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title="Adresse d'intervention" pinColor={t.colors.brand.primary} />
        ) : null}
        {artisan ? (
          <Marker coordinate={{ latitude: artisan.lat, longitude: artisan.lng }} title={artisanName ?? 'Artisan'} pinColor={t.colors.tone.info.solid} />
        ) : null}
      </MapView>
    </View>
  );
}
