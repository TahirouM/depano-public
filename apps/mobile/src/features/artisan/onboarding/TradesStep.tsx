import { DOMAIN_CODES, type DomainCode } from '@depano/schemas';
import {
  Button,
  DomainChip,
  ProgressHeader,
  Screen,
  SkeletonList,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { useDomains } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { useDraft } from '@/stores/drafts';
import { centsToInput, parseEuros, ServicesEditor } from '../components/ServicesEditor';
import { useArtisanProfile } from '../queries';
import {
  KYC_TOTAL,
  nextStepHref,
  ONBOARDING_DRAFT_KEY,
  stepIndex,
  type OnboardingDraft,
} from './kyc';

const DEFAULT_TRAVEL_FEE = 2500;

/** Étape 2 : métiers, prestations et tarifs (prix du marché proposés par défaut). */
export function TradesStep() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const catalog = useDomains();
  const profile = useArtisanProfile();
  const [draft, patch] = useDraft<OnboardingDraft>(ONBOARDING_DRAFT_KEY);
  const [feeText, setFeeText] = useState(
    centsToInput(draft.travelFeeCents ?? profile.data?.travelFeeCents ?? DEFAULT_TRAVEL_FEE),
  );

  // Reprise : métiers et prix déjà enregistrés côté serveur.
  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    if (!draft.domains?.length && p.domains.length) patch({ domains: p.domains });
    if (!draft.prices && p.services.length)
      patch({ prices: Object.fromEntries(p.services.map((s) => [s.serviceId, s.priceCents])) });
  }, [profile.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Métiers suggérés par le SIRET : prestations courantes cochées au prix du marché.
  useEffect(() => {
    const p = profile.data;
    if (!catalog.data || !p || draft.prices || p.services.length) return;
    const doms = draft.domains?.length ? draft.domains : p.domains;
    if (!doms.length) return;
    const defaults = Object.fromEntries(
      catalog.data
        .filter((d) => doms.includes(d.code))
        .flatMap((d) =>
          d.services.filter((sv) => sv.urgentEligible).map((sv) => [sv.id, sv.referencePriceCents]),
        ),
    );
    patch({ domains: doms, prices: defaults });
  }, [catalog.data, profile.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const domains = draft.domains ?? [];
  const prices = draft.prices ?? {};
  const selectedIds = Object.keys(prices).filter((id) =>
    catalog.data?.some((d) => domains.includes(d.code) && d.services.some((s) => s.id === id)),
  );
  const fee = parseEuros(feeText);

  const save = useMutation({
    mutationFn: async () => {
      const all = catalog.data!.flatMap((d) => d.services);
      await api.artisan.updateProfile({ domains, travelFeeCents: fee ?? 0 });
      return api.artisan.setServices({
        services: selectedIds.map((id) => ({
          serviceId: id,
          priceCents: prices[id]!,
          durationMinutes:
            draft.durations?.[id] ??
            profile.data?.services.find((s) => s.serviceId === id)?.durationMinutes ??
            all.find((s) => s.id === id)?.defaultDurationMinutes ??
            60,
        })),
      });
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.artisan.profile, p);
      router.push(nextStepHref(p.checklist, 'metiers'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggleDomain = (d: DomainCode) => {
    const next = domains.includes(d) ? domains.filter((x) => x !== d) : [...domains, d];
    // Prestations proposées par défaut pour un nouveau métier (prix du marché).
    const add = !domains.includes(d)
      ? (catalog.data?.find((c) => c.code === d)?.services ?? [])
      : [];
    const nextPrices = { ...prices };
    for (const s of add)
      if (nextPrices[s.id] == null && s.urgentEligible) nextPrices[s.id] = s.referencePriceCents;
    patch({ domains: next, prices: nextPrices });
  };

  const valid =
    domains.length > 0 &&
    selectedIds.length > 0 &&
    fee != null &&
    selectedIds.every((id) => (prices[id] ?? 0) > 0);

  return (
    <Screen
      footer={
        <Button
          label="Continuer"
          size="lg"
          fullWidth
          disabled={!valid}
          loading={save.isPending}
          onPress={() => save.mutate()}
          testID="trades-continue"
        />
      }
    >
      <Stack.Screen options={{ title: 'Métiers et tarifs' }} />
      <View style={{ gap: t.spacing.lg }}>
        <ProgressHeader
          step={stepIndex('metiers')}
          total={KYC_TOTAL}
          title="Quels métiers et prestations proposez-vous ?"
          subtitle="Les prix du marché à Marseille sont proposés par défaut : ajustez-les librement."
        />
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Vos métiers</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {DOMAIN_CODES.map((d) => (
              <DomainChip
                key={d}
                domain={d}
                selected={domains.includes(d)}
                onPress={() => toggleDomain(d)}
              />
            ))}
          </View>
        </View>
        <QueryView query={catalog} loading={<SkeletonList count={3} variant="row" />}>
          {(cat) =>
            domains.length ? (
              <ServicesEditor
                catalog={cat}
                domains={domains}
                prices={prices}
                onChange={(p) => patch({ prices: p })}
              />
            ) : (
              <Text tone="secondary">Choisissez au moins un métier pour voir les prestations.</Text>
            )
          }
        </QueryView>
        <TextField
          label="Frais de déplacement (€)"
          value={feeText}
          onChangeText={(v) => {
            setFeeText(v);
            const c = parseEuros(v);
            if (c != null) patch({ travelFeeCents: c });
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
          error={fee == null ? 'Indiquez un montant (0 si offerts).' : null}
          helper="Facturés une seule fois par intervention, sans commission DEPANO."
          testID="travel-fee"
        />
      </View>
    </Screen>
  );
}
