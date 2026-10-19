import type { LatLng } from './geo';

export interface LiveMapProps {
  /** Centre par défaut (adresse d'intervention ou position de recherche). */
  center: LatLng;
  /** Adresse d'intervention (épingle). */
  destination?: LatLng | null;
  /** Position de l'artisan en direct. */
  artisan?: LatLng | null;
  artisanName?: string | null;
  /** Points supplémentaires (ex. artisans de la recherche, position approchée). */
  markers?: MapMarker[];
  /** Rayon de recherche à dessiner (km). */
  radiusKm?: number;
  height?: number;
  /** Résumé lu par VoiceOver/TalkBack (la carte elle-même n'est pas accessible). */
  accessibilityLabel: string;
  /**
   * Libellé très court posé sur la carte (ex. « 12 min »), en capsule Liquid Glass sur iOS 26.
   * Purement visuel : l'information doit aussi figurer dans `accessibilityLabel` et à l'écran.
   */
  overlayLabel?: string | null;
}

export interface MapMarker extends LatLng {
  id: string;
  title: string;
  description?: string;
  onPress?: () => void;
}
