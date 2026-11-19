import { EVENT_COLORS, type AvailabilityExceptionDto, type EventColor } from '@depano/schemas';
import {
  Button,
  ConfirmSheet,
  Screen,
  SkeletonList,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Check, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { parseFrDate } from '../format';
import { localDayKey } from '../dates';
import { PLANNING_PREFIX, useExceptions } from '../queries';
import { EVENT_COLOR_LABELS, eventColor } from './eventColors';
import { isoToFr, isoToTime, maskDate, maskTime, toIso, validTime } from './form';

/**
 * Événement personnel du planning (« Manger avec Grégoire ») : titre, date, horaires, couleur.
 * Bloque les créneaux comme une indisponibilité. Modifier = recréer puis supprimer l'ancien.
 */
export function EventScreen({ date, id }: { date?: string; id?: string }) {
  const q = useExceptions();
  if (!id) return <EventForm date={date} />;
  const existing = q.data?.find((e) => e.id === id);
  if (!existing)
    return (
      <Screen inTabs>
        <Stack.Screen options={{ title: 'Événement' }} />
        {q.isPending ? (
          <SkeletonList count={3} variant="row" />
        ) : (
          <Text tone="secondary">Cet événement n'existe plus.</Text>
        )}
      </Screen>
    );
  return <EventForm existing={existing} />;
}

function EventForm({ date, existing }: { date?: string; existing?: AvailabilityExceptionDto }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const initialDay = existing ? localDayKey(existing.startsAt) : (date ?? localDayKey(new Date()));
  const [title, setTitle] = useState(existing?.reason ?? '');
  const [day, setDay] = useState(isoToFr(initialDay));
  const [from, setFrom] = useState(existing ? isoToTime(existing.startsAt) : '12:00');
  const [to, setTo] = useState(existing ? isoToTime(existing.endsAt) : '13:00');
  const [color, setColor] = useState<EventColor>(existing?.color ?? 'green');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const done = (message: string) => {
    void qc.invalidateQueries({ queryKey: PLANNING_PREFIX });
    void qc.invalidateQueries({ queryKey: qk.artisan.exceptions });
    toast.success(message);
    router.back();
  };

  const save = useMutation({
    mutationFn: async (b: {
      startsAt: string;
      endsAt: string;
      reason: string;
      color: EventColor;
    }) => {
      const created = await api.artisan.addException({ ...b, kind: 'personal' });
      if (existing) await api.artisan.deleteException(existing.id);
      return created;
    },
    onSuccess: () => done(existing ? 'Événement modifié.' : 'Événement ajouté à votre planning.'),
    onError: (e) => setError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => api.artisan.deleteException(existing!.id),
    onSuccess: () => {
      setConfirmDelete(false);
      done('Événement supprimé.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = () => {
    const d = parseFrDate(day);
    if (!title.trim()) return setError('Donnez un titre à l’événement.');
    if (!d) return setError('Date invalide (JJ/MM/AAAA).');
    if (!validTime(from) || !validTime(to)) return setError('Heure invalide (HH:MM).');
    const startsAt = toIso(d, from);
    const endsAt = toIso(d, to);
    if (endsAt <= startsAt) return setError('La fin doit être après le début.');
    setError(null);
    save.mutate({ startsAt, endsAt, reason: title.trim(), color });
  };

  return (
    <Screen
      inTabs
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Button
            label={existing ? 'Enregistrer' : "Ajouter l'événement"}
            size="lg"
            fullWidth
            loading={save.isPending}
            onPress={submit}
            testID="event-save"
          />
          {existing ? (
            <Button
              label="Supprimer l'événement"
              icon={Trash2}
              variant="ghost"
              fullWidth
              onPress={() => setConfirmDelete(true)}
              testID="event-remove"
            />
          ) : null}
        </View>
      }
      testID="event-screen"
    >
      <Stack.Screen
        options={{ title: existing ? "Modifier l'événement" : 'Ajouter un événement' }}
      />
      <View style={{ gap: t.spacing.lg }}>
        <Text tone="secondary">
          Visible par vous seul. Les clients ne pourront pas réserver sur ce créneau.
        </Text>
        <TextField
          label="Titre"
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Manger avec Grégoire"
          maxLength={200}
          testID="event-title"
        />
        <TextField
          label="Date"
          value={day}
          onChangeText={(v) => setDay(maskDate(v))}
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
          inputMode="numeric"
          testID="event-date"
        />
        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="De"
              value={from}
              onChangeText={(v) => setFrom(maskTime(v))}
              placeholder="HH:MM"
              keyboardType="number-pad"
              inputMode="numeric"
              testID="event-from"
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
              testID="event-to"
            />
          </View>
        </View>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label" nativeID="event-color-label">
            Couleur : {EVENT_COLOR_LABELS[color]}
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}
            accessibilityRole="radiogroup"
            accessibilityLabelledBy="event-color-label"
          >
            {EVENT_COLORS.map((c) => {
              const tone = eventColor(c, t);
              const sel = c === color;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={EVENT_COLOR_LABELS[c]}
                  onPress={() => setColor(c)}
                  style={{ alignItems: 'center', gap: 4, minWidth: 48 }}
                  testID={`event-color-${c}`}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: tone.solid,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: sel ? 3 : 0,
                      borderColor: t.colors.text.primary,
                    }}
                  >
                    {sel ? <Check size={20} color={tone.onSolid} /> : null}
                  </View>
                  <Text variant="caption" tone={sel ? 'primary' : 'secondary'}>
                    {EVENT_COLOR_LABELS[c]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        {error ? (
          <Text tone="danger" accessibilityLiveRegion="polite" testID="event-error">
            {error}
          </Text>
        ) : null}
      </View>
      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Supprimer « ${existing?.reason || 'Événement'} » ?`}
        message="Ce créneau redeviendra réservable par les clients."
        confirmLabel="Supprimer"
        tone="danger"
      />
    </Screen>
  );
}
