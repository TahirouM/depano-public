import { useCallback, useEffect, useState } from 'react';
import { getUserPosition, MARSEILLE } from '@/lib/permissions';
import { useAppStore } from '@/stores/app';
import { defaultAddress, useAddresses } from './queries';

export interface SearchOrigin {
  lat: number;
  lng: number;
  /** « Près de 12 rue Paradis », « Près de vous », « Marseille ». */
  label: string;
  approximate: boolean;
  /** Provenance : lieu choisi, position de l'appareil, adresse du compte, ou repli Marseille. */
  source: 'place' | 'gps' | 'address' | 'fallback';
}

/** Ville proposée par défaut (marché de lancement) quand la position n'est pas partagée. */
export const DEFAULT_CITY = { ...MARSEILLE, label: 'Marseille' } as const;

/** Libellé court du sélecteur de l'accueil (« Marseille », « Ma position », « 12 rue Paradis »). */
export function originShortLabel(o: Pick<SearchOrigin, 'label' | 'source'>): string {
  if (o.source === 'gps') return 'Ma position';
  return o.label.replace(/^Près de /, '');
}

/**
 * Point de recherche des artisans : lieu choisi dans le sélecteur, sinon position (si déjà autorisée
 * ou demandée), sinon adresse par défaut du compte, sinon centre de Marseille (mode dégradé).
 * Jamais de popup système au lancement : l'accueil propose « Utiliser ma position ».
 */
export function useSearchOrigin() {
  const addresses = useAddresses();
  const place = useAppStore((s) => s.searchPlace);
  const setPlace = useAppStore((s) => s.setSearchPlace);
  const [gps, setGps] = useState<SearchOrigin | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let alive = true;
    void getUserPosition({ ask: false }).then((p) => {
      if (alive && !p.approximate) setGps({ lat: p.lat, lng: p.lng, label: 'Près de vous', approximate: false, source: 'gps' });
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Demande la position (écran d'explication puis popup système) ; true si obtenue. */
  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const p = await getUserPosition({ ask: true, reason: 'Pour trouver les artisans proches de chez vous' });
      if (!p.approximate) {
        setGps({ lat: p.lat, lng: p.lng, label: 'Près de vous', approximate: false, source: 'gps' });
        setPlace(null);
      }
      return !p.approximate;
    } finally {
      setLocating(false);
    }
  }, [setPlace]);

  const home = defaultAddress(addresses.data);
  const origin: SearchOrigin = place
    ? { lat: place.lat, lng: place.lng, label: place.label, approximate: false, source: 'place' }
    : (gps ??
      (home
        ? { lat: home.lat, lng: home.lng, label: `Près de ${home.line1}`, approximate: false, source: 'address' }
        : { ...DEFAULT_CITY, approximate: true, source: 'fallback' }));
  return { origin, locate, locating, setPlace };
}
