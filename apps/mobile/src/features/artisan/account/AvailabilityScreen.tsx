import type { ArtisanPrivateProfileDto } from '@depano/schemas';
import {
  Button,
  Card,
  Divider,
  ListItem,
  Screen,
  SectionHeader,
  SkeletonList,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { CalendarOff, CalendarPlus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { exceptionLabel } from '../dates';
import { rulesError, WeekRulesEditor, type Rule } from '../components/WeekRulesEditor';
import { ZoneEditor, type ZoneValue } from '../components/ZoneEditor';
import { useArtisanProfile, useExceptions } from '../queries';

/** Disponibilités : horaires types par jour, congés, rayon d'intervention. */
export function AvailabilityScreen() {
  const profile = useArtisanProfile();
  return (
    <>
      <Stack.Screen options={{ title: 'Disponibilités' }} />
      <QueryView query={profile} loading={<SkeletonList count={5} variant="row" />}>
        {(p) => <AvailabilityForm p={p} />}
      </QueryView>
    </>
  );
}

function AvailabilityForm({ p }: { p: ArtisanPrivateProfileDto }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const exceptions = useExceptions();
  const [rules, setRules] = useState<Rule[]>(p.availabilityRules);
  const [zone, setZone] = useState<ZoneValue>({
    city: p.baseCity ?? undefined,
    lat: p.baseLat ?? undefined,
    lng: p.baseLng ?? undefined,
    radiusKm: p.radiusKm,
  });
  const err = rulesError(rules);

  const save = useMutation({
    mutationFn: async () => {
      await api.artisan.updateProfile({
        radiusKm: zone.radiusKm,
        baseLat: zone.lat,
        baseLng: zone.lng,
        baseCity: zone.city?.slice(0, 100),
      });
      return api.artisan.setAvailabilityRules({ rules });
    },
    onSuccess: (np) => {
      qc.setQueryData(qk.artisan.profile, np);
      void qc.invalidateQueries({ queryKey: ['artisan', 'planning'] });
      toast.success('Disponibilités enregistrées.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const upcoming = (exceptions.data ?? [])
    .filter((e) => new Date(e.endsAt).getTime() > Date.now())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <Screen
      inTabs
      footer={
        <Button
          label="Enregistrer"
          size="lg"
          fullWidth
          disabled={!!err}
          loading={save.isPending}
          onPress={() => save.mutate()}
          testID="availability-save"
        />
      }
    >
      <View style={{ gap: t.spacing.lg }}>
        <SectionHeader title="Horaires types" />
        <WeekRulesEditor rules={rules} onChange={setRules} />
        {err ? (
          <Text tone="danger" variant="callout">
            {err}
          </Text>
        ) : null}

        <SectionHeader
          title="Congés et indisponibilités"
          action={{ label: 'Ajouter', onPress: () => router.push('/pro/planning/indisponibilite') }}
        />
        {upcoming.length ? (
          <Card padding="none">
            {upcoming.map((e, i) => (
              <View key={e.id}>
                {i > 0 ? <Divider inset={56} /> : null}
                <ListItem
                  icon={CalendarOff}
                  title={e.reason || 'Indisponible'}
                  subtitle={exceptionLabel(e)}
                  chevron={false}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Button
            label="Ajouter des congés"
            icon={CalendarPlus}
            variant="secondary"
            onPress={() => router.push('/pro/planning/indisponibilite')}
          />
        )}

        <SectionHeader title="Zone d'intervention" />
        <ZoneEditor value={zone} onChange={setZone} />
      </View>
    </Screen>
  );
}
