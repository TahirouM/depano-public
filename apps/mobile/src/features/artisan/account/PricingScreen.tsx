import {
  DOMAIN_CODES,
  type ArtisanPrivateProfileDto,
  type DomainCode,
  type DomainDto,
} from '@depano/schemas';
import {
  Button,
  DomainChip,
  Screen,
  SkeletonList,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { useDomains } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { centsToInput, parseEuros, ServicesEditor } from '../components/ServicesEditor';
import { useArtisanProfile } from '../queries';

/** Tarifs : prix par prestation (référence marché en aide) et frais de déplacement. */
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
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    Object.fromEntries(p.services.map((s) => [s.serviceId, s.priceCents])),
  );
  const [fee, setFee] = useState(centsToInput(p.travelFeeCents));
  const feeCents = parseEuros(fee);
  const ids = Object.keys(prices).filter((id) =>
    catalog.some((d) => domains.includes(d.code) && d.services.some((s) => s.id === id)),
  );
  const valid = domains.length > 0 && ids.length > 0 && feeCents != null;

  const save = useMutation({
    mutationFn: async () => {
      const all = catalog.flatMap((d) => d.services);
      await api.artisan.updateProfile({ domains, travelFeeCents: feeCents! });
      return api.artisan.setServices({
        services: ids.map((id) => ({
          serviceId: id,
          priceCents: prices[id]!,
          durationMinutes:
            p.services.find((s) => s.serviceId === id)?.durationMinutes ??
            all.find((s) => s.id === id)?.defaultDurationMinutes ??
            60,
        })),
      });
    },
    onSuccess: (np) => {
      qc.setQueryData(qk.artisan.profile, np);
      toast.success('Tarifs enregistrés.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

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
          Prix TTC affichés aux clients. En urgence, des frais fixes s'ajoutent automatiquement.
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
        <ServicesEditor catalog={catalog} domains={domains} prices={prices} onChange={setPrices} />
        <TextField
          label="Frais de déplacement (€)"
          value={fee}
          onChangeText={setFee}
          keyboardType="decimal-pad"
          inputMode="decimal"
          error={feeCents == null ? 'Indiquez un montant (0 si offerts).' : null}
          helper="Une fois par intervention, sans commission DEPANO."
          testID="pricing-travel-fee"
        />
      </View>
    </Screen>
  );
}
