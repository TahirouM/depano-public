import { Glass, GlassGroup, Icon, MIN_TOUCH, Text, useReduceMotion, useTheme } from '@depano/ui';
import { Clock, LocateFixed } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import type { LiveMapProps } from './types';

/**
 * Carte native (Apple Plans / Google Maps) : adresse, artisan en direct, rayon de recherche.
 * Contrôles flottants en Liquid Glass (iOS 26 ; surface opaque ailleurs) : bouton « Recentrer »
 * et, si fourni, un libellé court (ETA). Aucun texte long sur le verre.
 */
export function LiveMap({ center, destination, artisan, artisanName, markers, radiusKm, height = 260, accessibilityLabel, overlayLabel }: LiveMapProps) {
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const ref = useRef<MapView>(null);
  const span = radiusKm ? (radiusKm / 111) * 2.4 : 0.03;

  const fit = (animated: boolean) => {
    const pts = [destination, artisan].filter(Boolean) as { lat: number; lng: number }[];
    if (pts.length < 2) return false;
    ref.current?.fitToCoordinates(
      pts.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated },
    );
    return true;
  };

  useEffect(() => {
    fit(!reduceMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, artisan]);

  const recenter = () => {
    if (fit(!reduceMotion)) return;
    ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: span, longitudeDelta: span }, reduceMotion ? 0 : 300);
  };

  return (
    <View style={{ height, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.colors.background.subtle }}>
      <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
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
          {markers?.map((m) => (
            <Marker
              key={m.id}
              identifier={m.id}
              coordinate={{ latitude: m.lat, longitude: m.lng }}
              title={m.title}
              description={m.description}
              pinColor={t.colors.tone.info.solid}
              onCalloutPress={m.onPress}
            />
          ))}
        </MapView>
      </View>

      {overlayLabel ? (
        <View style={[styles.topLeft, { margin: t.spacing.sm }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Glass legible style={[styles.chip, { paddingHorizontal: t.spacing.md, gap: t.spacing.xs }]}>
            <Icon icon={Clock} size={16} />
            <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.5}>
              {overlayLabel}
            </Text>
          </Glass>
        </View>
      ) : null}

      <GlassGroup style={[styles.bottomRight, { margin: t.spacing.sm }]}>
        <Pressable
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Recentrer la carte"
          hitSlop={4}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}
          testID="map-recenter"
        >
          <Glass interactive legible style={styles.round}>
            <Icon icon={LocateFixed} size={22} color={t.colors.text.brand} />
          </Glass>
        </Pressable>
      </GlassGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  topLeft: { position: 'absolute', top: 0, left: 0 },
  bottomRight: { position: 'absolute', bottom: 0, right: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
