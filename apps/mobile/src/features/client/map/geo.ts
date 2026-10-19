export interface LatLng {
  lat: number;
  lng: number;
}

/** Distance à vol d'oiseau (km), formule de haversine. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Projette un point dans un carré de côté 2 × radiusKm centré sur `center` (repli web de la carte) :
 * x, y ∈ [0, 1] (0,0 = coin nord-ouest), bornés aux bords si le point est hors du carré.
 */
export function projectInRadius(center: LatLng, radiusKm: number, p: LatLng): { x: number; y: number } {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  const dx = ((p.lng - center.lng) * kmPerDegLng) / (2 * radiusKm);
  const dy = ((center.lat - p.lat) * kmPerDegLat) / (2 * radiusKm);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { x: clamp(0.5 + dx), y: clamp(0.5 + dy) };
}
