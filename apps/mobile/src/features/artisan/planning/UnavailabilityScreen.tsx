import {
  Button,
  Chip,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { PLANNING_PREFIX } from '../queries';
import { parseFrDate } from '../components/DocumentUpload';
import { addDays } from '../dates';
import { isoToFr, maskDate, maskTime, toIso, validTime } from './form';

const REASONS = [
  'Congés',
  'Formation',
  'Rendez-vous personnel',
  'Arrêt maladie',
  'Chantier hors DEPANO',
];

/** Ajout d'une indisponibilité personnelle (congés, rendez-vous…) : bloque les créneaux. */
export function UnavailabilityScreen({ date }: { date?: string }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const today = new Date();
  const initial =
    date ??
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [mode, setMode] = useState<'days' | 'hours'>('days');
  const [start, setStart] = useState(isoToFr(initial));
  const [end, setEnd] = useState(isoToFr(initial));
  const [from, setFrom] = useState('12:00');
  const [to, setTo] = useState('14:00');
  const [reason, setReason] = useState<string>('Congés');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (b: { startsAt: string; endsAt: string; reason?: string }) =>
      api.artisan.addException({ ...b, kind: 'unavailable' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PLANNING_PREFIX });
      void qc.invalidateQueries({ queryKey: qk.artisan.exceptions });
      toast.success('Indisponibilité ajoutée. Ces créneaux ne sont plus réservables.');
      router.back();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = () => {
    const s = parseFrDate(start);
    const e = mode === 'days' ? parseFrDate(end) : s;
    if (!s || !e) return setError('Date invalide (JJ/MM/AAAA).');
    if (mode === 'hours' && (!validTime(from) || !validTime(to)))
      return setError('Heure invalide (HH:MM).');
    const startsAt = mode === 'days' ? toIso(s, '00:00') : toIso(s, from);
    const endsAt =
      mode === 'days' ? addDays(new Date(toIso(e, '00:00')), 1).toISOString() : toIso(s, to);
    if (endsAt <= startsAt) return setError('La fin doit être après le début.');
    setError(null);
    add.mutate({ startsAt, endsAt, reason: reason || undefined });
  };

  return (
    <Screen
      inTabs
      footer={
        <Button
          label="Ajouter l'indisponibilité"
          size="lg"
          fullWidth
          loading={add.isPending}
          onPress={submit}
          testID="unavailability-save"
        />
      }
    >
      <Stack.Screen options={{ title: 'Indisponibilité' }} />
      <View style={{ gap: t.spacing.lg }}>
        <Text tone="secondary">
          Les clients ne pourront pas réserver sur cette période. Vos rendez-vous déjà pris restent
          maintenus.
        </Text>
        <SegmentedControl
          options={[
            { value: 'days', label: 'Journées entières' },
            { value: 'hours', label: 'Quelques heures' },
          ]}
          value={mode}
          onChange={setMode}
          accessibilityLabel="Type d'indisponibilité"
        />
        <TextField
          label={mode === 'days' ? 'Du' : 'Le'}
          value={start}
          onChangeText={(v) => {
            const m = maskDate(v);
            setStart(m);
            if (
              mode === 'days' &&
              parseFrDate(m) &&
              (!parseFrDate(end) || parseFrDate(end)! < parseFrDate(m)!)
            )
              setEnd(m);
          }}
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
          inputMode="numeric"
          testID="unavailability-start"
        />
        {mode === 'days' ? (
          <TextField
            label="Au (inclus)"
            value={end}
            onChangeText={(v) => setEnd(maskDate(v))}
            placeholder="JJ/MM/AAAA"
            keyboardType="number-pad"
            inputMode="numeric"
            testID="unavailability-end"
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="De"
                value={from}
                onChangeText={(v) => setFrom(maskTime(v))}
                placeholder="HH:MM"
                keyboardType="number-pad"
                inputMode="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="À"
                value={to}
                onChangeText={(v) => setTo(maskTime(v))}
                placeholder="HH:MM"
                keyboardType="number-pad"
                inputMode="numeric"
              />
            </View>
          </View>
        )}
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Motif (privé)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {REASONS.map((r) => (
              <Chip
                key={r}
                label={r}
                selected={reason === r}
                onPress={() => setReason(reason === r ? '' : r)}
              />
            ))}
          </View>
        </View>
        {error ? (
          <Text tone="danger" accessibilityLiveRegion="polite" testID="unavailability-error">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
