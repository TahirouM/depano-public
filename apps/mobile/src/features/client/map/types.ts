import type { LatLng } from './geo';

export interface LiveMapProps {
  /** Centre par défaut (adresse d'intervention ou position de recherche). */
  center: LatLng;
  /** Adresse d'intervention (épingle). */
  destination?: LatLng | null;
  /** Position de l'artisan en direct. */
  artisan?: LatLng | null;
  artisanName?: string | null;
  /** Rayon de recherche à dessiner (km). */
  radiusKm?: number;
  height?: number;
  /** Résumé lu par VoiceOver/TalkBack (la carte elle-même n'est pas accessible). */
  accessibilityLabel: string;
}
