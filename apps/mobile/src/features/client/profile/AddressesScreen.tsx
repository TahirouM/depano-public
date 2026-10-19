import type { AddressBody, AddressDto } from '@depano/schemas';
import { Badge, BottomSheet, Button, Card, Chip, ConfirmSheet, Divider, ListItem, Screen, SkeletonList, Switch, Text, TextField, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Briefcase, Home, MapPin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { newClientId } from '@/lib/id';
import { qk } from '@/lib/query/keys';
import { optimistic } from '@/lib/query/optimistic';
import { AccessFields } from '../components/AccessFields';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { addressLabel } from '../drafts';
import { useAddresses } from '../queries';

const LABELS = ['Domicile', 'Travail', 'Autre'];
type Editing = { mode: 'new' } | { mode: 'edit'; address: AddressDto } | null;
type Form = Partial<AddressBody>;

/** Carnet d'adresses : ajout avec autocomplétion, modification, adresse par défaut, suppression. */
export function AddressesScreen() {
  return (
    <AuthGate title="Adresses" message="Connectez-vous pour gérer vos adresses.">
      <AddressesInner />
    </AuthGate>
  );
}

function AddressesInner() {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useAddresses();
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState<Form>({});
  const [toDelete, setToDelete] = useState<AddressDto | null>(null);

  const setDefaultLocal = (list: AddressDto[] | undefined, id: string | null, isDefault: boolean | undefined) =>
    isDefault ? list?.map((a) => ({ ...a, isDefault: a.id === id })) : list;

  const create = useMutation({
    mutationFn: (b: AddressBody & { tempId: string }) => {
      const { tempId: _t, ...body } = b;
      return api.me.createAddress(body);
    },
    ...optimistic<AddressDto[], AddressBody & { tempId: string }>(qc, {
      queryKey: () => qk.addresses,
      update: (old, b) => setDefaultLocal([...(old ?? []), { ...b, id: b.tempId, isDefault: b.isDefault || !(old ?? []).length }], b.tempId, b.isDefault),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Form }) => api.me.updateAddress(id, patch),
    ...optimistic<AddressDto[], { id: string; patch: Form }>(qc, {
      queryKey: () => qk.addresses,
      update: (old, { id, patch }) => setDefaultLocal(old?.map((a) => (a.id === id ? { ...a, ...patch } : a)), id, patch.isDefault),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.me.deleteAddress(id),
    ...optimistic<AddressDto[], string>(qc, {
      queryKey: () => qk.addresses,
      update: (old, id) => old?.filter((a) => a.id !== id),
      onError: (e) => toast.error(errorMessage(e)),
    }),
  });

  const openNew = () => {
    setForm({ label: (q.data?.length ?? 0) === 0 ? 'Domicile' : 'Autre', isDefault: (q.data?.length ?? 0) === 0 });
    setEditing({ mode: 'new' });
  };
  const openEdit = (a: AddressDto) => {
    setForm({ ...a });
    setEditing({ mode: 'edit', address: a });
  };
  const valid = !!form.line1 && !!form.postalCode && !!form.city && form.lat != null && form.lng != null;
  const save = () => {
    if (!editing || !valid) return;
    const body: AddressBody = {
      label: form.label || 'Domicile',
      line1: form.line1!,
      postalCode: form.postalCode!,
      city: form.city!,
      lat: form.lat!,
      lng: form.lng!,
      floor: form.floor ?? null,
      doorCode: form.doorCode ?? null,
      accessNotes: form.accessNotes ?? null,
      isDefault: !!form.isDefault,
    };
    if (editing.mode === 'new') create.mutate({ ...body, tempId: `tmp-${newClientId()}` });
    else update.mutate({ id: editing.address.id, patch: body });
    setEditing(null);
  };

  return (
    <Screen inTabs footer={<Button size="lg" fullWidth icon={Plus} label="Ajouter une adresse" onPress={openNew} testID="add-address" />}>
      <Stack.Screen options={{ title: 'Adresses' }} />
      <QueryView
        query={q}
        loading={<SkeletonList count={2} variant="row" />}
        isEmpty={(d) => d.length === 0}
        empty={{ icon: MapPin, title: 'Aucune adresse enregistrée', message: "Enregistrez votre domicile pour réserver plus vite : l'adresse sera pré-remplie.", action: { label: 'Ajouter une adresse', onPress: openNew } }}
      >
        {(list) => (
          <Card padding="none" testID="address-list">
            {list.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <Divider inset={56} /> : null}
                <ListItem
                  icon={a.label === 'Travail' ? Briefcase : a.label === 'Domicile' ? Home : MapPin}
                  title={a.label}
                  subtitle={addressLabel(a)}
                  right={a.isDefault ? <Badge label="Par défaut" tone="brand" appearance="soft" /> : undefined}
                  onPress={() => openEdit(a)}
                  accessibilityHint="Modifier ou supprimer"
                />
              </View>
            ))}
          </Card>
        )}
      </QueryView>

      <BottomSheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? "Modifier l'adresse" : 'Nouvelle adresse'}
        testID="address-sheet"
        footer={
          <View style={{ gap: t.spacing.sm }}>
            <Button size="lg" fullWidth label="Enregistrer" disabled={!valid} onPress={save} testID="save-address" />
            {editing?.mode === 'edit' ? (
              <Button
                variant="ghost"
                fullWidth
                label="Supprimer cette adresse"
                onPress={() => {
                  setToDelete(editing.address);
                  setEditing(null);
                }}
              />
            ) : null}
          </View>
        }
      >
        <View style={{ gap: t.spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
            {LABELS.map((l) => (
              <Chip key={l} label={l} selected={form.label === l} onPress={() => setForm((f) => ({ ...f, label: l }))} />
            ))}
          </View>
          {editing?.mode === 'edit' ? (
            <Card variant="flat" padding="md">
              <Text variant="bodyStrong">{addressLabel(editing.address)}</Text>
              <Text variant="caption" tone="secondary">
                Pour changer de rue, ajoutez une nouvelle adresse.
              </Text>
            </Card>
          ) : (
            <AddressAutocomplete
              testID="new-address-input"
              allowLocate
              onSelect={(s) => setForm((f) => ({ ...f, line1: s.line1, postalCode: s.postalCode, city: s.city, lat: s.lat, lng: s.lng }))}
            />
          )}
          {editing?.mode === 'edit' && form.label && !LABELS.includes(form.label) ? (
            <TextField label="Nom" value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v.slice(0, 40) }))} />
          ) : null}
          <AccessFields value={form} onChange={(p) => setForm((f) => ({ ...f, ...p }))} />
          <Switch label="Adresse par défaut" description="Pré-remplie à chaque demande." value={!!form.isDefault} onValueChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} />
        </View>
      </BottomSheet>

      <ConfirmSheet
        visible={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id);
          setToDelete(null);
        }}
        title="Supprimer cette adresse ?"
        message={toDelete ? addressLabel(toDelete) : undefined}
        confirmLabel="Supprimer"
        tone="danger"
      />
    </Screen>
  );
}
