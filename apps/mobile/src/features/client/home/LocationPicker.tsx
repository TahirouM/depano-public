import { BottomSheet, Card, Divider, Icon, ListItem, Text, useTheme } from '@depano/ui';
import { Building2, ChevronDown, House, LocateFixed, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { addressLabel } from '../drafts';
import { useAddresses } from '../queries';
import { DEFAULT_CITY, originShortLabel, type SearchOrigin } from '../useSearchOrigin';
import type { SearchPlace } from '@/stores/app';

export interface LocationPickerProps {
  origin: SearchOrigin;
  locating: boolean;
  locate: () => Promise<boolean>;
  setPlace: (p: SearchPlace | null) => void;
}

/** Sélecteur « 📍 Marseille ⌄ » de l'accueil : position, adresses enregistrées, ville, autre adresse. */
export function LocationPicker({ origin, locating, locate, setPlace }: LocationPickerProps) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const addresses = useAddresses();
  const label = locating ? 'Localisation…' : originShortLabel(origin);

  const choose = (p: SearchPlace | null) => {
    setPlace(p);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID="home-location"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Lieu de recherche : ${label}`}
        accessibilityHint="Changer de lieu pour voir les artisans proches"
        hitSlop={4}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, minHeight: 48, paddingHorizontal: t.spacing.sm, opacity: pressed ? 0.7 : 1 })}
      >
        <Icon icon={MapPin} size={20} color={t.colors.text.primary} />
        <Text variant="bodyStrong" numberOfLines={1} style={{ maxWidth: 220 }}>
          {label}
        </Text>
        <Icon icon={ChevronDown} size={18} color={t.colors.text.secondary} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Où chercher un artisan ?" description="Les résultats dépendent de votre position." scrollable testID="location-sheet">
        <View style={{ gap: t.spacing.lg }}>
          <Card padding="none">
            <ListItem
              icon={LocateFixed}
              title="Utiliser ma position"
              subtitle={origin.source === 'gps' ? 'Position actuelle utilisée' : 'Recommandé : artisans au plus près'}
              onPress={() => {
                setOpen(false);
                void locate();
              }}
              testID="location-gps"
            />
            {(addresses.data ?? []).map((a) => (
              <View key={a.id}>
                <Divider inset={56} />
                <ListItem
                  icon={House}
                  title={a.label ?? a.line1}
                  subtitle={addressLabel(a)}
                  onPress={() => choose({ lat: a.lat, lng: a.lng, label: a.line1 })}
                />
              </View>
            ))}
            <Divider inset={56} />
            <ListItem icon={Building2} title={DEFAULT_CITY.label} subtitle="Centre-ville" onPress={() => choose({ ...DEFAULT_CITY })} testID="location-city" />
          </Card>
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">Autre adresse</Text>
            <AddressAutocomplete
              label="Adresse ou ville"
              allowLocate={false}
              near={{ lat: origin.lat, lng: origin.lng }}
              onSelect={(s) => choose({ lat: s.lat, lng: s.lng, label: s.line1 || s.city })}
              testID="location-search"
            />
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
