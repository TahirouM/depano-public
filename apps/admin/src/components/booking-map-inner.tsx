'use client';

import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { MapPoint } from './booking-map';

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  // Ne recadre que si les points changent réellement (pas à chaque rendu).
  const key = JSON.stringify(points);
  useEffect(() => {
    const pts = JSON.parse(key) as [number, number][];
    if (pts.length === 1) map.setView(pts[0]!, 15);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [24, 24], maxZoom: 16 });
  }, [map, key]);
  return null;
}

const COLORS = { address: '#C8102E', event: '#8A6A4A', track: '#1F5FBF' } as const;

export default function BookingMapInner({ points, track }: { points: MapPoint[]; track: [number, number][] }) {
  const all: [number, number][] = [...points.map((p) => [p.lat, p.lng] as [number, number]), ...track];
  const center = all[0] ?? [43.2965, 5.3698];
  return (
    <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-80 w-full rounded-lg" attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {track.length > 1 && <Polyline positions={track} pathOptions={{ color: COLORS.track, weight: 3, opacity: 0.8 }} />}
      {track.map((t, i) => (
        <CircleMarker key={`t${i}`} center={t} radius={3} pathOptions={{ color: COLORS.track, fillOpacity: 1, weight: 1 }} />
      ))}
      {points.map((p, i) => (
        <CircleMarker
          key={`p${i}`}
          center={[p.lat, p.lng]}
          radius={p.kind === 'address' ? 9 : 7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: COLORS[p.kind], fillOpacity: 1 }}
        >
          <Tooltip direction="top">{p.label}</Tooltip>
          <Popup>
            <strong>{p.label}</strong>
            {p.detail && <div>{p.detail}</div>}
          </Popup>
        </CircleMarker>
      ))}
      <FitBounds points={all} />
    </MapContainer>
  );
}
