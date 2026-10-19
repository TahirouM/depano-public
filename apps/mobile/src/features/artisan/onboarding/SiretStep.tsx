import { Siret } from '@depano/schemas';
import {
  Badge,
  Button,
  Card,
  ProgressHeader,
  Screen,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Building2, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useDraft } from '@/stores/drafts';
import { useArtisanProfile } from '../queries';
import {
  apeWarning,
  KYC_TOTAL,
  nextStepHref,
  ONBOARDING_DRAFT_KEY,
  stepIndex,
  type OnboardingDraft,
} from './kyc';

const formatSiret = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,5}).*/, (_m, a, b, c, d) =>
      [a, b, c, d].filter(Boolean).join(' '),
    );

/** Étape 1 : SIRET → nom, adresse et activité pré-remplis (API Recherche d'entreprises). */
export function SiretStep() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useArtisanProfile();
  const [draft, patch] = useDraft<OnboardingDraft>(ONBOARDING_DRAFT_KEY);
  const [input, setInput] = useState(formatSiret(draft.siret ?? ''));
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profil déjà renseigné côté serveur : on reprend son SIRET.
  useEffect(() => {
    if (!input && profile.data?.siret) setInput(formatSiret(profile.data.siret));
  }, [profile.data?.siret]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookup = useMutation({
    mutationFn: (siret: string) => api.artisan.lookupSiret({ siret }),
    onSuccess: (info) => {
      setError(null);
      patch({
        siret: info.siret,
        company: info,
        domains: draft.domains?.length ? draft.domains : info.suggestedDomains,
        city: draft.city ?? info.city ?? undefined,
      });
      void qc.invalidateQueries({ queryKey: qk.artisan.profile });
      void qc.invalidateQueries({ queryKey: qk.me });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const save = useMutation({
    mutationFn: (name: string) => api.artisan.updateProfile({ displayName: name }),
    onSuccess: (p) => {
      qc.setQueryData(qk.artisan.profile, p);
      router.push(nextStepHref(p.checklist, 'siret'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const digits = input.replace(/\D/g, '');
  const runLookup = (v = digits) => {
    const parsed = Siret.safeParse(v);
    if (!parsed.success) {
      setError('Le SIRET contient 14 chiffres.');
      return;
    }
    lookup.mutate(parsed.data);
  };

  const info = draft.company && draft.company.siret === digits ? draft.company : null;
  const fromProfile =
    !info && profile.data?.siret === digits && profile.data.companyName ? profile.data : null;
  const warning = info ? apeWarning(info) : null;
  const name = displayName ?? profile.data?.displayName ?? info?.name ?? '';
  // Entreprise fermée au répertoire SIRENE : impossible d'être validé, on bloque l'étape.
  const closed = !!info && !info.active;
  const ready = !!(info || fromProfile) && !closed && name.trim().length >= 2;

  return (
    <Screen
      footer={
        <Button
          label="Continuer"
          size="lg"
          fullWidth
          disabled={!ready}
          loading={save.isPending}
          onPress={() => save.mutate(name.trim())}
          testID="siret-continue"
        />
      }
    >
      <Stack.Screen options={{ title: 'Entreprise' }} />
      <View style={{ gap: t.spacing.lg }}>
        <ProgressHeader
          step={stepIndex('siret')}
          total={KYC_TOTAL}
          title="Quel est le SIRET de votre entreprise ?"
          subtitle="Nom, adresse et activité sont remplis automatiquement."
        />
        <TextField
          label="Numéro SIRET (14 chiffres)"
          value={input}
          onChangeText={(v) => {
            const f = formatSiret(v);
            setInput(f);
            setError(null);
            const d = f.replace(/\D/g, '');
            if (d.length === 14 && d !== info?.siret) runLookup(d);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="off"
          error={error}
          helper="Il figure sur votre extrait Kbis ou votre avis de situation INSEE."
          testID="siret-input"
        />
        {!info && !fromProfile ? (
          <Button
            label="Rechercher mon entreprise"
            variant="secondary"
            loading={lookup.isPending}
            onPress={() => runLookup()}
            disabled={digits.length !== 14}
            testID="siret-lookup"
          />
        ) : null}

        {info || fromProfile ? (
          <Card variant="brand" style={{ gap: t.spacing.sm }} testID="siret-company">
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Building2 size={22} color={t.colors.text.brand} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {info?.name || fromProfile?.companyName}
              </Text>
              {info ? (
                <Badge
                  label={info.active ? 'Active' : 'Fermée'}
                  tone={info.active ? 'success' : 'danger'}
                />
              ) : null}
            </View>
            <Text variant="callout" tone="secondary">
              {info
                ? [info.address, info.postalCode, info.city].filter(Boolean).join(', ')
                : fromProfile?.companyAddress}
            </Text>
            <Text variant="callout" tone="secondary">
              Activité (APE) :{' '}
              {info
                ? `${info.apeCode ?? '—'}${info.apeLabel ? ` · ${info.apeLabel}` : ''}`
                : (fromProfile?.apeCode ?? '—')}
            </Text>
          </Card>
        ) : null}

        {warning ? (
          <Card
            variant="outline"
            style={{
              flexDirection: 'row',
              gap: t.spacing.sm,
              borderColor: t.colors.tone.warning.solid,
            }}
            testID="siret-ape-warning"
          >
            <TriangleAlert size={22} color={t.colors.tone.warning.text} />
            <Text variant="callout" style={{ flex: 1 }}>
              {warning}
            </Text>
          </Card>
        ) : null}

        {info || fromProfile ? (
          <TextField
            label="Nom affiché aux clients"
            value={name}
            onChangeText={setDisplayName}
            helper="Par exemple « Karim B. » ou le nom de votre entreprise."
            maxLength={80}
            testID="display-name"
          />
        ) : null}
      </View>
    </Screen>
  );
}
