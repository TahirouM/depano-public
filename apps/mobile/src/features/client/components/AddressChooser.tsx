import type { AddressDto } from '@depano/schemas';
import { Card, Icon, Skeleton, Switch, Text, useTheme } from '@depano/ui';
import { Circle, CircleCheck, Home, Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useIsSignedIn } from '@/lib/query/hooks';
import { addressLabel, suggestionToAddress, type InlineAddress } from '../drafts';
import { defaultAddress, useAddresses } from '../queries';
import { AccessFields, type AccessValue } from './AccessFields';
import { AddressAutocomplete } from './AddressAutocomplete';

export interface AddressChoice {
  addressId?: string;
  address?: InlineAddress;
}

/** Adresse sélectionnée → coordonnées (pour l'estimation et la zone). */
export function choicePoint(c: AddressChoice, saved: AddressDto[] | undefined): { lat: number; lng: number } | null {
  if (c.address) return { lat: c.address.lat, lng: c.address.lng };
  const a = saved?.find((x) => x.id === c.addressId);
  return a ? { lat: a.lat, lng: a.lng } : null;
}

/**
 * Corps « adresse » de la réservation : l'identifiant enregistré si rien n'a changé,
 * sinon l'adresse saisie (le carnet n'est pas modifié).
 */
export function toBookingAddress(c: AddressChoice, saved: AddressDto[] | undefined): AddressChoice {
  const a = c.addressId ? saved?.find((x) => x.id === c.addressId) : undefined;
  if (a && c.address) {
    const same = (x: string | null | undefined, y: string | null | undefined) => (x || null) === (y || null);
    if (same(a.floor, c.address.floor) && same(a.doorCode, c.address.doorCode) && same(a.accessNotes, c.address.accessNotes)) return { addressId: a.id };
    const { saveAs: _s, ...rest } = c.address;
    return { address: rest };
  }
  if (a) return { addressId: a.id };
  return c.address ? { address: c.address } : {};
}

function savedToInline(a: AddressDto): InlineAddress {
  return { line1: a.line1, postalCode: a.postalCode, city: a.city, lat: a.lat, lng: a.lng, floor: a.floor ?? null, doorCode: a.doorCode ?? null, accessNotes: a.accessNotes ?? null };
}

/**
 * Choix de l'adresse d'intervention : carnet d'adresses (pré-rempli avec l'adresse par défaut)
 * ou nouvelle adresse avec autocomplétion, puis étage / digicode / accès.
 */
export function AddressChooser({ value, onChange }: { value: AddressChoice; onChange: (v: AddressChoice) => void }) {
  const t = useTheme();
  const signedIn = useIsSignedIn();
  const saved = useAddresses();
  const list = saved.data ?? [];

  // Pré-remplissage : adresse par défaut du compte.
  useEffect(() => {
    if (value.addressId || value.address || !saved.data) return;
    const d = defaultAddress(saved.data);
    if (d) onChange({ addressId: d.id, address: savedToInline(d) });
  }, [saved.data, value.addressId, value.address, onChange]);

  const newMode = !value.addressId;

  const radio = (key: string, title: string, subtitle: string | null, selected: boolean, onPress: () => void, icon = Home) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: 56,
        padding: t.spacing.md,
        borderRadius: t.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.colors.brand.primary : t.colors.border.subtle,
        backgroundColor: selected ? t.colors.background.brand : t.colors.background.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon icon={selected ? CircleCheck : Circle} color={selected ? t.colors.brand.primary : t.colors.text.secondary} />
      <Icon icon={icon} size={20} color={t.colors.text.secondary} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle ? (
          <Text variant="callout" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  const access: AccessValue = value.address ?? {};
  return (
    <View style={{ gap: t.spacing.lg }}>
      {signedIn && saved.isPending ? <Skeleton height={56} radius={t.radius.md} /> : null}
      {list.length ? (
        <View style={{ gap: t.spacing.sm }} accessibilityRole="radiogroup">
          {list.map((a) =>
            radio(a.id, a.label, addressLabel(a), value.addressId === a.id, () => onChange({ addressId: a.id, address: savedToInline(a) })),
          )}
          {radio('new', 'Une autre adresse', null, newMode, () => onChange({ addressId: undefined, address: undefined }), Plus)}
        </View>
      ) : null}

      {newMode ? (
        <View style={{ gap: t.spacing.md }}>
          <AddressAutocomplete
            testID="address-input"
            initialText={value.address ? addressLabel(value.address) : ''}
            onSelect={(s) => onChange({ addressId: undefined, address: { ...suggestionToAddress(s), floor: access.floor ?? null, doorCode: access.doorCode ?? null, accessNotes: access.accessNotes ?? null, saveAs: value.address?.saveAs } })}
          />
          {value.address ? (
            <Card variant="flat" padding="md">
              <Text variant="callout" tone="secondary">
                Adresse retenue
              </Text>
              <Text variant="bodyStrong">{addressLabel(value.address)}</Text>
            </Card>
          ) : null}
        </View>
      ) : null}

      {value.address ? (
        <AccessFields
          value={access}
          onChange={(p) => onChange({ addressId: value.addressId, address: { ...value.address!, ...p } })}
        />
      ) : null}

      {signedIn && newMode && value.address ? (
        <Switch
          label="Enregistrer dans mes adresses"
          value={!!value.address.saveAs}
          onValueChange={(v) => onChange({ address: { ...value.address!, saveAs: v ? (list.length ? 'Autre' : 'Domicile') : undefined } })}
        />
      ) : null}
    </View>
  );
}
