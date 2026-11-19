import {
  DOMAIN_CODES,
  DOMAIN_LABELS,
  type ArtisanOwnServiceDto,
  type ArtisanPrivateProfileDto,
  type ArtisanServicesBody,
  type DomainCode,
  type DomainDto,
} from '@depano/schemas';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmSheet,
  Divider,
  DomainChip,
  IconButton,
  Screen,
  SegmentedControl,
  SkeletonList,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { useDomains } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { centsToInput, parseEuros, ServiceRow } from '../components/ServicesEditor';
import { useArtisanProfile } from '../queries';
import {
  customServiceErrors,
  durationLabel,
  SERVICE_KIND_LABELS,
  type CustomServiceDraft,
  type ServiceKind,
} from './pricing';

/**
 * Tarifs : prix par prestation (référence marché en aide), motifs personnels (« + » par métier),
 * activation / désactivation sans perte du prix, frais de déplacement.
 */
export function PricingScreen() {
  const profile = useArtisanProfile();
  const catalog = useDomains();
  const both = {
    ...profile,
    data: profile.data && catalog.data ? { p: profile.data, c: catalog.data } : undefined,
    isError: profile.isError || catalog.isError,
    error: profile.error ?? catalog.error,
    refetch: async () => {
      await Promise.all([profile.refetch(), catalog.refetch()]);
    },
  };
  return (
    <>
      <Stack.Screen options={{ title: 'Tarifs' }} />
      <QueryView query={both as never} loading={<SkeletonList count={4} variant="row" />}>
        {(d: { p: ArtisanPrivateProfileDto; c: DomainDto[] }) => (
          <PricingForm p={d.p} catalog={d.c} />
        )}
      </QueryView>
    </>
  );
}

function PricingForm({ p, catalog }: { p: ArtisanPrivateProfileDto; catalog: DomainDto[] }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [domains, setDomains] = useState<DomainCode[]>(p.domains);
  /** Prix de toutes les prestations connues, actives ou non (un motif désactivé garde son prix). */
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(p.services.map((s) => [s.serviceId, s.priceCents])),
  );
  const [active, setActive] = useState<Set<string>>(
    () => new Set(p.services.filter((s) => s.active).map((s) => s.serviceId)),
  );
  const [fee, setFee] = useState(centsToInput(p.travelFeeCents));
  const [adding, setAdding] = useState<DomainCode | null>(null);
  const [toDelete, setToDelete] = useState<ArtisanOwnServiceDto | null>(null);
  const feeCents = parseEuros(fee);

  const custom = p.services.filter((s) => s.custom);
  const domainOf = (id: string): DomainCode | undefined =>
    p.services.find((s) => s.serviceId === id)?.domain ??
    catalog.find((d) => d.services.some((s) => s.id === id))?.code;
  /** Proposés aux clients : cochés, avec un prix, dans un métier sélectionné. */
  const activeIds = [...active].filter((id) => {
    const d = domainOf(id);
    return prices[id] != null && d != null && domains.includes(d);
  });
  const valid = domains.length > 0 && activeIds.length > 0 && feeCents != null;

  const toggle = (id: string, reference: number | null) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (prices[id] == null && reference != null) setPrices({ ...prices, [id]: reference });
    }
    setActive(next);
  };

  const save = useMutation({
    mutationFn: async () => {
      const all = catalog.flatMap((d) => d.services);
      const known = new Set(p.services.map((s) => s.serviceId));
      const enabled = new Set(activeIds);
      // Toutes les prestations déjà enregistrées (désactivées comprises, prix conservé) + les nouvelles cochées.
      const ids = Object.keys(prices).filter((id) => known.has(id) || enabled.has(id));
      const services: ArtisanServicesBody['services'] = ids.map((id) => ({
        serviceId: id,
        priceCents: prices[id]!,
        durationMinutes:
          p.services.find((s) => s.serviceId === id)?.durationMinutes ??
          all.find((s) => s.id === id)?.defaultDurationMinutes ??
          60,
        active: enabled.has(id),
      }));
      await api.artisan.updateProfile({ domains, travelFeeCents: feeCents! });
      return api.artisan.setServices({ services });
    },
    onSuccess: (np) => {
      qc.setQueryData(qk.artisan.profile, np);
      toast.success('Tarifs enregistrés.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.artisan.deleteCustomService(id),
    onSuccess: (np, id) => {
      qc.setQueryData(qk.artisan.profile, np);
      setPrices(({ [id]: _, ...rest }) => rest);
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setToDelete(null);
      toast.success('Motif supprimé.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  /** Motif ajouté : actif tout de suite, sans écraser les modifications non enregistrées. */
  const onAdded = (np: ArtisanPrivateProfileDto) => {
    qc.setQueryData(qk.artisan.profile, np);
    const added = np.services.filter((s) => s.custom && prices[s.serviceId] == null);
    if (added.length) {
      setPrices((prev) => ({
        ...prev,
        ...Object.fromEntries(added.map((s) => [s.serviceId, s.priceCents])),
      }));
      setActive(
        (prev) => new Set([...prev, ...added.filter((s) => s.active).map((s) => s.serviceId)]),
      );
    }
    setAdding(null);
    toast.success('Motif ajouté à vos tarifs.');
  };

  return (
    <Screen
      inTabs
      footer={
        <Button
          label="Enregistrer mes tarifs"
          size="lg"
          fullWidth
          disabled={!valid}
          loading={save.isPending}
          onPress={() => save.mutate()}
          testID="pricing-save"
        />
      }
    >
      <View style={{ gap: t.spacing.lg }}>
        <Text tone="secondary">
          Prix TTC affichés aux clients. Décochez un motif pour ne plus le proposer : son prix est
          conservé.
          {features.urgent ? " En urgence, des frais fixes s'ajoutent automatiquement." : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {DOMAIN_CODES.map((d) => (
            <DomainChip
              key={d}
              domain={d}
              selected={domains.includes(d)}
              onPress={() =>
                setDomains(domains.includes(d) ? domains.filter((x) => x !== d) : [...domains, d])
              }
            />
          ))}
        </View>

        {catalog
          .filter((d) => domains.includes(d.code))
          .map((d) => {
            const own = custom.filter((s) => s.domain === d.code);
            return (
              <View key={d.code} style={{ gap: t.spacing.xs }} testID={`pricing-domain-${d.code}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <Text variant="overline" tone="secondary" accessibilityRole="header">
                    {DOMAIN_LABELS[d.code]}
                  </Text>
                  <IconButton
                    icon={Plus}
                    accessibilityLabel={`Ajouter un motif en ${DOMAIN_LABELS[d.code].toLowerCase()}`}
                    onPress={() => setAdding(d.code)}
                    color={t.colors.text.brand}
                    testID={`pricing-add-${d.code}`}
                  />
                </View>
                <Card padding="none">
                  {d.services.map((s, i) => (
                    <View key={s.id}>
                      {i > 0 ? <Divider /> : null}
                      <ServiceRow
                        name={s.name}
                        reference={s.referencePriceCents}
                        on={active.has(s.id)}
                        cents={prices[s.id]}
                        onToggle={() => toggle(s.id, s.referencePriceCents)}
                        onPrice={(c) => setPrices({ ...prices, [s.id]: c })}
                        testID={`service-${s.slug}`}
                      />
                    </View>
                  ))}
                  {own.map((s) => (
                    <View key={s.serviceId}>
                      <Divider />
                      <ServiceRow
                        name={s.name}
                        reference={null}
                        caption={`${SERVICE_KIND_LABELS[s.kind]} · ${durationLabel(s.durationMinutes)}`}
                        custom
                        on={active.has(s.serviceId)}
                        cents={prices[s.serviceId]}
                        onToggle={() => toggle(s.serviceId, null)}
                        onPrice={(c) => setPrices({ ...prices, [s.serviceId]: c })}
                        onDelete={() => setToDelete(s)}
                        testID={`custom-service-${s.serviceId}`}
                      />
                    </View>
                  ))}
                </Card>
              </View>
            );
          })}

        <TextField
          label="Frais de déplacement (€)"
          value={fee}
          onChangeText={setFee}
          keyboardType="decimal-pad"
          inputMode="decimal"
          error={feeCents == null ? 'Indiquez un montant (0 si offerts).' : null}
          helper="Facturés une fois par intervention."
          testID="pricing-travel-fee"
        />
      </View>

      {adding ? (
        <AddServiceSheet
          domain={adding}
          existingNames={[
            ...(catalog.find((d) => d.code === adding)?.services.map((s) => s.name) ?? []),
            ...custom.filter((s) => s.domain === adding).map((s) => s.name),
          ]}
          onClose={() => setAdding(null)}
          onAdded={onAdded}
        />
      ) : null}
      <ConfirmSheet
        visible={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.serviceId)}
        loading={remove.isPending}
        tone="danger"
        title={`Supprimer « ${toDelete?.name ?? 'ce motif'} » ?`}
        message="Il disparaît de vos tarifs et n'est plus proposé aux clients. Les rendez-vous déjà pris ne changent pas. Pour le masquer temporairement, décochez-le plutôt."
        confirmLabel="Supprimer le motif"
      />
    </Screen>
  );
}

const KIND_OPTIONS: { value: ServiceKind; label: string }[] = [
  { value: 'maintenance', label: SERVICE_KIND_LABELS.maintenance },
  { value: 'repair', label: SERVICE_KIND_LABELS.repair },
  { value: 'both', label: SERVICE_KIND_LABELS.both },
];

/** Formulaire « Ajouter un motif » (nom, type, prix TTC, durée) pour un métier. */
function AddServiceSheet({
  domain,
  existingNames,
  onClose,
  onAdded,
}: {
  domain: DomainCode;
  existingNames: string[];
  onClose: () => void;
  onAdded: (p: ArtisanPrivateProfileDto) => void;
}) {
  const t = useTheme();
  const toast = useToast();
  const [draft, setDraft] = useState<CustomServiceDraft>({
    name: '',
    kind: 'both',
    price: '',
    duration: '60',
  });
  // Erreurs affichées après la première tentative (pas de rouge sur un formulaire vierge).
  const [submitted, setSubmitted] = useState(false);
  const errors = customServiceErrors(draft, existingNames);
  const shown = submitted ? errors : {};
  const patch = (v: Partial<CustomServiceDraft>) => setDraft((d) => ({ ...d, ...v }));

  const add = useMutation({
    mutationFn: () =>
      api.artisan.addCustomService({
        domain,
        name: draft.name.trim(),
        kind: draft.kind,
        priceCents: parseEuros(draft.price)!,
        durationMinutes: Number(draft.duration),
      }),
    onSuccess: onAdded,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length === 0) add.mutate();
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title="Ajouter un motif"
      description={`${DOMAIN_LABELS[domain]} : un motif à vous, proposé aux clients à la prise de rendez-vous.`}
      footer={
        <Button
          label="Ajouter le motif"
          icon={Plus}
          size="lg"
          fullWidth
          loading={add.isPending}
          onPress={submit}
          testID="custom-service-submit"
        />
      }
      testID="custom-service-sheet"
    >
      <View style={{ gap: t.spacing.lg }}>
        <TextField
          label="Nom du motif"
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          placeholder="Ex. Remplacement de groupe de sécurité"
          maxLength={120}
          autoCapitalize="sentences"
          error={shown.name}
          testID="custom-service-name"
        />
        <View style={{ gap: t.spacing.xs }}>
          <Text variant="label">Type d'intervention</Text>
          <SegmentedControl
            options={KIND_OPTIONS}
            value={draft.kind}
            onChange={(kind) => patch({ kind })}
            accessibilityLabel="Type d'intervention"
          />
        </View>
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Prix TTC (€)"
              value={draft.price}
              onChangeText={(price) => patch({ price })}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="Ex. 120"
              error={shown.price}
              testID="custom-service-price"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="Durée (min)"
              value={draft.duration}
              onChangeText={(duration) => patch({ duration })}
              keyboardType="number-pad"
              inputMode="numeric"
              error={shown.duration}
              testID="custom-service-duration"
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
