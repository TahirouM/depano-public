import { formatDistance, Icon, Text, useTheme } from '@depano/ui';
import { Car, Home, MapPin } from 'lucide-react-native';
import { View } from 'react-native';
import { haversineKm } from './geo';
import type { LiveMapProps } from './types';

/**
 * Repli web (react-native-maps n'existe pas sur le web) : schéma sobre avec la distance
 * entre l'artisan et l'adresse. Même API que la carte native.
 */
export function LiveMap({ center, destination, artisan, artisanName, radiusKm, height = 200, accessibilityLabel }: LiveMapProps) {
  const t = useTheme();
  const dest = destination ?? center;
  const km = artisan ? haversineKm(artisan, dest) : null;
  // Position relative de l'artisan sur le trajet (0 = loin, 1 = arrivé), bornée pour rester lisible.
  const progress = km == null ? 0 : Math.max(0.08, Math.min(0.92, 1 - km / 8));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        height,
        borderRadius: t.radius.md,
        backgroundColor: t.colors.background.brand,
        padding: t.spacing.lg,
        justifyContent: 'center',
        gap: t.spacing.md,
      }}
    >
      {artisan ? (
        <>
          <View style={{ height: 48, justifyContent: 'center' }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: t.colors.border.subtle }} />
            <View style={{ position: 'absolute', left: 0, width: `${progress * 100}%`, height: 4, borderRadius: 2, backgroundColor: t.colors.tone.info.solid }} />
            <View style={{ position: 'absolute', left: `${progress * 100}%`, marginLeft: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.tone.info.solid, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={Car} size={20} color={t.colors.tone.info.onSolid} />
            </View>
            <View style={{ position: 'absolute', right: -4, width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.brand.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={Home} size={20} color={t.colors.brand.onPrimary} />
            </View>
          </View>
          <Text variant="callout" tone="secondary" align="center">
            {artisanName ?? "L'artisan"} est à {formatDistance(km)} de chez vous
          </Text>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <Icon icon={MapPin} size={32} color={t.colors.text.brand} />
          <Text variant="callout" tone="secondary" align="center">
            {radiusKm ? `Recherche dans un rayon de ${radiusKm} km` : 'Position partagée dès le départ de l’artisan'}
          </Text>
        </View>
      )}
    </View>
  );
}
