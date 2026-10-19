import { useCallback, useEffect, useState } from 'react';
import { getUserPosition, MARSEILLE } from '@/lib/permissions';
import { defaultAddress, useAddresses } from './queries';

export interface SearchOrigin {
  lat: number;
  lng: number;
  /** « Près de 12 rue Paradis », « Près de vous », « Marseille ». */
  label: string;
  approximate: boolean;
}

/**
 * Point de recherche des artisans : position (si déjà autorisée ou demandée), sinon adresse
 * par défaut du compte, sinon centre de Marseille (mode dégradé). Jamais de popup au lancement.
 */
export function useSearchOrigin() {
  const addresses = useAddresses();
  const [gps, setGps] = useState<SearchOrigin | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let alive = true;
    void getUserPosition({ ask: false }).then((p) => {
      if (alive && !p.approximate) setGps({ lat: p.lat, lng: p.lng, label: 'Près de vous', approximate: false });
    });
    return () => {
      alive = false;
    };
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const p = await getUserPosition({ ask: true, reason: 'Pour trouver les artisans proches de chez vous' });
      if (!p.approximate) setGps({ lat: p.lat, lng: p.lng, label: 'Près de vous', approximate: false });
      return !p.approximate;
    } finally {
      setLocating(false);
    }
  }, []);

  const home = defaultAddress(addresses.data);
  const origin: SearchOrigin =
    gps ?? (home ? { lat: home.lat, lng: home.lng, label: `Près de ${home.line1}`, approximate: false } : { ...MARSEILLE, label: 'Marseille', approximate: true });
  return { origin, locate, locating };
}
