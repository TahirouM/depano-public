'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  kind: 'address' | 'event';
}

// Leaflet manipule window : chargement uniquement côté client.
const Inner = dynamic(() => import('./booking-map-inner'), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-lg" />,
});

export function BookingMap({ points, track }: { points: MapPoint[]; track: [number, number][] }) {
  if (points.length === 0 && track.length === 0)
    return <p className="text-sm text-muted-foreground">Aucune position GPS enregistrée.</p>;
  return (
    <div className="grid gap-2">
      <Inner points={points} track={track} />
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Légende de la carte">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-urgent" /> Adresse d’intervention
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full bg-primary" /> Changement de statut
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 bg-info" /> Trajet de l’artisan ({track.length} points)
        </li>
      </ul>
    </div>
  );
}
