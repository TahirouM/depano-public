import type { AddressSuggestion } from '@depano/schemas';
import { Button, Card, ListItem, Text, TextField, useTheme } from '@depano/ui';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { features } from '@/lib/env';
import { getUserPosition, MARSEILLE } from '@/lib/permissions';
import { qk } from '@/lib/query/keys';
import { RadiusPicker } from './RadiusPicker';
import { ZoneMap } from './ZoneMap';

export interface ZoneValue {
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm: number;
}

function useDebounced<T>(v: T, ms = 350): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const h = setTimeout(() => setD(v), ms);
    return () => clearTimeout(h);
  }, [v, ms]);
  return d;
}

/** Point de départ (ville / adresse ou position) + rayon d'intervention sur carte. */
export function ZoneEditor({
  value,
  onChange,
}: {
  value: ZoneValue;
  onChange: (v: ZoneValue) => void;
}) {
  const t = useTheme();
  const [q, setQ] = useState(value.city ?? '');
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const dq = useDebounced(q.trim());
  const suggestions = useQuery({
    queryKey: qk.catalog.address(dq),
    queryFn: () =>
      api.catalog.searchAddress(
        dq,
        value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : MARSEILLE,
      ),
    enabled: open && dq.length >= 3,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (value.city && !q) setQ(value.city);
  }, [value.city]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (s: AddressSuggestion) => {
    const city =
      s.city === s.line1 ? s.city : `${s.city}${s.postalCode ? ` (${s.postalCode})` : ''}`;
    setQ(city);
    setOpen(false);
    onChange({ ...value, city, lat: s.lat, lng: s.lng });
  };

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await getUserPosition({
        ask: true,
        reason: 'Pour définir votre point de départ',
      });
      const rev = await api.catalog.reverseGeocode(pos.lat, pos.lng).catch(() => null);
      const city = rev
        ? `${rev.city}${rev.postalCode ? ` (${rev.postalCode})` : ''}`
        : (value.city ?? 'Marseille');
      setQ(city);
      setOpen(false);
      onChange({ ...value, city, lat: pos.lat, lng: pos.lng });
    } finally {
      setLocating(false);
    }
  };

  const located = value.lat != null && value.lng != null;
  return (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ gap: t.spacing.sm }}>
        <TextField
          label="Ville ou adresse de départ"
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Ex. Marseille 5e"
          autoComplete="off"
          left={<MapPin size={20} color={t.colors.text.secondary} />}
          helper={
            located ? 'Point de départ enregistré.' : 'Choisissez une proposition dans la liste.'
          }
          testID="zone-city"
        />
        {open && suggestions.data?.length ? (
          <Card padding="none" testID="zone-suggestions">
            {suggestions.data.slice(0, 5).map((s) => (
              <ListItem
                key={`${s.label}-${s.lat}`}
                title={s.label}
                subtitle={s.postalCode}
                icon={MapPin}
                chevron={false}
                onPress={() => pick(s)}
              />
            ))}
          </Card>
        ) : null}
        <Button
          label="Utiliser ma position"
          icon={LocateFixed}
          variant="ghost"
          size="sm"
          loading={locating}
          onPress={() => void locate()}
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
      <ZoneMap
        lat={value.lat ?? MARSEILLE.lat}
        lng={value.lng ?? MARSEILLE.lng}
        radiusKm={value.radiusKm}
      />
      <View style={{ gap: t.spacing.xs }}>
        <Text variant="label">Rayon d'intervention</Text>
        <Text variant="callout" tone="secondary">
          {features.urgent
            ? 'Vous recevez les urgences situées dans ce rayon autour de votre position.'
            : 'Vous recevez les demandes des clients situés dans ce rayon autour de votre adresse.'}
        </Text>
      </View>
      <RadiusPicker
        value={value.radiusKm}
        onChange={(radiusKm) => onChange({ ...value, radiusKm })}
      />
    </View>
  );
}
