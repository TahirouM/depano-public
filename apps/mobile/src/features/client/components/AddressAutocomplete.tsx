import type { AddressSuggestion } from '@depano/schemas';
import { Button, Card, Divider, ListItem, Skeleton, Text, TextField, useTheme, useToast } from '@depano/ui';
import { LocateFixed, MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { getUserPosition } from '@/lib/permissions';
import { useAddressSearch } from '../queries';

export interface AddressAutocompleteProps {
  onSelect: (s: AddressSuggestion) => void;
  initialText?: string;
  near?: { lat: number; lng: number };
  label?: string;
  /** Bouton « Utiliser ma position » (géolocalisation + adresse inverse). */
  allowLocate?: boolean;
  error?: string | null;
  testID?: string;
}

/** Saisie d'adresse assistée : suggestions de la Base Adresse Nationale via l'API. */
export function AddressAutocomplete({ onSelect, initialText = '', near, label = 'Adresse', allowLocate = true, error, testID }: AddressAutocompleteProps) {
  const t = useTheme();
  const toast = useToast();
  const [text, setText] = useState(initialText);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const search = useAddressSearch(open ? text : '', near);

  const pick = (s: AddressSuggestion) => {
    setText(s.label);
    setOpen(false);
    onSelect(s);
  };

  const locate = async () => {
    setLocating(true);
    try {
      const pos = await getUserPosition({ ask: true, reason: "Pour pré-remplir l'adresse d'intervention" });
      if (pos.approximate) {
        toast.show('Position indisponible : saisissez votre adresse.');
        return;
      }
      const s = await api.catalog.reverseGeocode(pos.lat, pos.lng);
      if (s) pick(s);
      else toast.show('Adresse introuvable à cette position : saisissez-la.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const items = search.data ?? [];
  return (
    <View style={{ gap: t.spacing.sm }}>
      <TextField
        testID={testID}
        label={label}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setOpen(true);
        }}
        placeholder="N° et rue, ville"
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        autoCorrect={false}
        returnKeyType="search"
        error={error}
        helper={!error && open && text.trim().length > 0 && text.trim().length < 3 ? 'Encore quelques lettres…' : undefined}
        left={<MapPin size={20} color={t.colors.text.secondary} />}
      />
      {open && text.trim().length >= 3 ? (
        <Card padding="none" variant="outline">
          {search.isPending && search.fetchStatus !== 'idle' ? (
            <View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
              <Skeleton width="80%" />
              <Skeleton width="60%" />
            </View>
          ) : items.length === 0 ? (
            <View style={{ padding: t.spacing.lg, flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Search size={18} color={t.colors.text.secondary} />
              <Text tone="secondary" variant="callout">
                {search.isError ? errorMessage(search.error) : 'Aucune adresse trouvée. Vérifiez la saisie.'}
              </Text>
            </View>
          ) : (
            items.slice(0, 5).map((s, i) => (
              <View key={`${s.label}-${i}`}>
                {i > 0 ? <Divider inset={56} /> : null}
                <ListItem icon={MapPin} title={s.line1} subtitle={`${s.postalCode} ${s.city}`} onPress={() => pick(s)} accessibilityLabel={`Choisir ${s.label}`} />
              </View>
            ))
          )}
        </Card>
      ) : null}
      {allowLocate ? (
        <Button variant="ghost" icon={LocateFixed} label="Utiliser ma position" onPress={() => void locate()} loading={locating} />
      ) : null}
    </View>
  );
}
