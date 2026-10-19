import {
  Button,
  ProgressHeader,
  Screen,
  SectionHeader,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useDraft } from '@/stores/drafts';
import { DEFAULT_RULES, rulesError, WeekRulesEditor } from '../components/WeekRulesEditor';
import { ZoneEditor } from '../components/ZoneEditor';
import { useArtisanProfile } from '../queries';
import {
  KYC_TOTAL,
  nextStepHref,
  ONBOARDING_DRAFT_KEY,
  stepIndex,
  type OnboardingDraft,
} from './kyc';

/** Étape 3 : zone d'intervention (rayon sur carte) et horaires types. */
export function ZoneStep() {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const profile = useArtisanProfile();
  const [draft, patch] = useDraft<OnboardingDraft>(ONBOARDING_DRAFT_KEY);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    const next: Partial<OnboardingDraft> = {};
    if (draft.lat == null && p.baseLat != null && p.baseLng != null)
      Object.assign(next, { lat: p.baseLat, lng: p.baseLng });
    if (!draft.city && p.baseCity) next.city = p.baseCity;
    if (draft.radiusKm == null && p.radiusKm) next.radiusKm = p.radiusKm;
    if (!draft.rules && p.availabilityRules.length) next.rules = p.availabilityRules;
    if (Object.keys(next).length) patch(next);
  }, [profile.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const rules = draft.rules ?? DEFAULT_RULES;
  const radiusKm = draft.radiusKm ?? 10;
  const rErr = rulesError(rules);
  const located = draft.lat != null && draft.lng != null;

  const save = useMutation({
    mutationFn: async () => {
      await api.artisan.updateProfile({
        baseLat: draft.lat,
        baseLng: draft.lng,
        baseCity: draft.city?.slice(0, 100),
        radiusKm,
      });
      return api.artisan.setAvailabilityRules({ rules });
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.artisan.profile, p);
      router.push(nextStepHref(p.checklist, 'zone'));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Screen
      footer={
        <Button
          label="Continuer"
          size="lg"
          fullWidth
          disabled={!located || !!rErr || rules.length === 0}
          loading={save.isPending}
          onPress={() => save.mutate()}
          testID="zone-continue"
        />
      }
    >
      <Stack.Screen options={{ title: 'Zone et horaires' }} />
      <View style={{ gap: t.spacing.lg }}>
        <ProgressHeader
          step={stepIndex('zone')}
          total={KYC_TOTAL}
          title="Où et quand intervenez-vous ?"
        />
        <ZoneEditor
          value={{ city: draft.city, lat: draft.lat, lng: draft.lng, radiusKm }}
          onChange={(v) => patch({ city: v.city, lat: v.lat, lng: v.lng, radiusKm: v.radiusKm })}
        />
        <SectionHeader title="Horaires types" />
        <Text variant="callout" tone="secondary">
          Les clients réservent des rendez-vous dans ces plages. Les urgences, elles, dépendent de
          l'interrupteur « Disponible ».
        </Text>
        <WeekRulesEditor rules={rules} onChange={(r) => patch({ rules: r })} />
        {rErr ? (
          <Text variant="callout" tone="danger" accessibilityLiveRegion="polite">
            {rErr}
          </Text>
        ) : rules.length === 0 ? (
          <Text variant="callout" tone="danger">
            Ouvrez au moins un jour.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
