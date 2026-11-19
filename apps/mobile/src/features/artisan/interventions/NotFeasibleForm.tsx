import {
  formatEuros,
  NOT_FEASIBLE_REASON_LABELS,
  NOT_FEASIBLE_REASONS,
  type BookingDetailDto,
  type NotFeasibleReason,
} from '@depano/schemas';
import {
  BottomSheet,
  Button,
  Card,
  Chip,
  ConfirmSheet,
  formatDateTime,
  Screen,
  Text,
  TextField,
  useTheme,
} from '@depano/ui';
import { router } from 'expo-router';
import { Ban, CalendarClock, CheckCircle2 } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { useDraft } from '@/stores/drafts';
import { PhotoGrid } from '../components/PhotoGrid';
import { addDays, localDayKey, monthGrid, startOfDay, startOfMonth } from '../dates';
import type { ReportPhoto } from '../mutations';
import { useNotFeasible, usePlanning } from '../queries';
import { dayDots, dayItems } from '../planning/calendar';
import { MonthCalendar } from '../planning/MonthCalendar';
import { maskTime, toIso, validTime } from '../planning/form';
import { FormRow } from './FormRow';

interface NotFeasibleDraft {
  reason?: NotFeasibleReason;
  comment?: string;
  photos?: ReportPhoto[];
}

const QUICK_TIMES = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];

/**
 * Intervention non réalisable (maquette, client absent…) : seuls les frais de déplacement sont facturés.
 * Deux issues : « Reprogrammer » (nouvelle date proposée au client) ou « Annuler l'intervention ».
 */
export function NotFeasibleForm({ b, header }: { b: BookingDetailDto; header: ReactNode }) {
  const t = useTheme();
  const [draft, patch, reset] = useDraft<NotFeasibleDraft>(`notfeasible:${b.id}`);
  const send = useNotFeasible(b.id);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [result, setResult] = useState<BookingDetailDto | null>(null);
  const photos = draft.photos ?? [];
  const reason = draft.reason ?? 'client_absent';
  const fee = formatEuros(b.price.travelFeeCents);

  const submit = async (action: 'cancel' | 'reschedule', rescheduleAt?: string) => {
    setError(null);
    try {
      // Photos encore locales (réseau coupé au moment de la prise) : téléversées maintenant.
      const photoFileIds = await Promise.all(
        photos.map(async (p) => p.fileId ?? (await uploadFile(p, 'report_before')).fileId),
      );
      const nb = await send.mutateAsync({
        reason,
        comment: draft.comment?.trim() || undefined,
        photoFileIds,
        action,
        rescheduleAt,
      });
      reset();
      setCancelOpen(false);
      setRescheduleOpen(false);
      setResult(nb);
    } catch (e) {
      setCancelOpen(false);
      setError(errorMessage(e));
    }
  };

  if (result) return <NotFeasibleResult b={result} />;

  return (
    <Screen
      inTabs
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Button
            label="Reprogrammer"
            icon={CalendarClock}
            size="lg"
            fullWidth
            disabled={send.isPending}
            onPress={() => setRescheduleOpen(true)}
            testID="not-feasible-reschedule"
          />
          <Button
            label="Annuler l'intervention"
            icon={Ban}
            variant="danger"
            fullWidth
            disabled={send.isPending}
            onPress={() => setCancelOpen(true)}
            testID="not-feasible-cancel"
          />
        </View>
      }
      testID="not-feasible-screen"
    >
      <View style={{ gap: t.spacing.md }}>
        {header}
        <FormRow label="Tarif d’intervention" value={fee} testID="not-feasible-fee" />
        <Card variant="flat">
          <Text variant="callout" tone="secondary">
            Frais de déplacement facturés : {fee}. Le reste de l’empreinte bancaire est libéré pour
            le client.
          </Text>
        </Card>

        <Card style={{ gap: t.spacing.sm }}>
          <Text variant="bodyStrong" nativeID="nf-reason">
            Motif
          </Text>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}
            accessibilityRole="radiogroup"
            accessibilityLabelledBy="nf-reason"
          >
            {NOT_FEASIBLE_REASONS.map((r) => (
              <Chip
                key={r}
                label={NOT_FEASIBLE_REASON_LABELS[r]}
                selected={reason === r}
                onPress={() => patch({ reason: r })}
                testID={`nf-reason-${r}`}
              />
            ))}
          </View>
        </Card>

        <Card>
          <TextField
            label="Raisons"
            value={draft.comment ?? ''}
            onChangeText={(v) => patch({ comment: v })}
            placeholder="Ex. personne au rendez-vous, 2 appels sans réponse"
            helper="Transmis au client et au support en cas de contestation."
            multiline
            maxLength={2000}
            testID="nf-comment"
          />
        </Card>

        <Card>
          <PhotoGrid
            label="Ajouter des photos"
            photos={photos}
            onChange={(p) => patch({ photos: p })}
            purpose="report_before"
            max={10}
            testID="nf-photos"
          />
        </Card>

        {error ? (
          <Text tone="danger" accessibilityLiveRegion="polite" testID="nf-error">
            {error}
          </Text>
        ) : null}
      </View>

      <ConfirmSheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void submit('cancel')}
        loading={send.isPending}
        tone="danger"
        title="Annuler l’intervention ?"
        message={`Les frais de déplacement (${fee}) restent facturés au client. Il est prévenu avec le motif « ${NOT_FEASIBLE_REASON_LABELS[reason]} ».`}
        confirmLabel="Annuler l'intervention"
        cancelLabel="Retour"
      />
      <RescheduleSheet
        visible={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        loading={send.isPending}
        onConfirm={(at) => void submit('reschedule', at)}
      />
    </Screen>
  );
}

/** Nouvelle date : calendrier du mois (jours occupés marqués) + heure. */
function RescheduleSheet({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (iso: string) => void;
  loading: boolean;
}) {
  const t = useTheme();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const grid = useMemo(() => monthGrid(month), [month]);
  const planning = usePlanning(grid[0]!.toISOString(), addDays(grid[41]!, 1).toISOString());
  const today = startOfDay(new Date());

  const confirm = () => {
    if (!day) return setError('Choisissez un jour.');
    if (!validTime(time)) return setError('Heure invalide (HH:MM).');
    const iso = toIso(localDayKey(day), time);
    if (new Date(iso) <= new Date()) return setError('Choisissez un créneau à venir.');
    setError(null);
    onConfirm(iso);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Reprogrammer"
      description="Le client reçoit la nouvelle date. Les frais de déplacement de ce passage restent facturés."
      footer={
        <Button
          label={
            day
              ? `Proposer le ${formatDateTime(new Date(toIso(localDayKey(day), validTime(time) ? time : '09:00')))}`
              : 'Proposer ce créneau'
          }
          size="lg"
          fullWidth
          loading={loading}
          disabled={!day}
          onPress={confirm}
          testID="reschedule-confirm"
        />
      }
      testID="reschedule-sheet"
    >
      <View style={{ gap: t.spacing.lg }}>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={day}
          onSelect={setDay}
          isDisabled={(d) => d < today}
          dotsFor={(d) => (planning.data ? dayDots(dayItems(planning.data, d)) : [])}
          describe={(d) => {
            const n = planning.data ? dayItems(planning.data, d).length : 0;
            return n ? `${n} élément${n > 1 ? 's' : ''} au planning` : null;
          }}
          testID="reschedule-calendar"
        />
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Heure</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            {QUICK_TIMES.map((h) => (
              <Chip key={h} label={h} size="sm" selected={time === h} onPress={() => setTime(h)} />
            ))}
          </View>
          <TextField
            label="Autre heure"
            value={time}
            onChangeText={(v) => setTime(maskTime(v))}
            placeholder="HH:MM"
            keyboardType="number-pad"
            inputMode="numeric"
            testID="reschedule-time"
          />
        </View>
        {error ? (
          <Text tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** Après envoi : annulée (client prévenu) ou nouveau RDV proposé. */
function NotFeasibleResult({ b }: { b: BookingDetailDto }) {
  const t = useTheme();
  const nextId = b.notFeasible?.rescheduledBookingId ?? null;
  return (
    <Screen
      inTabs
      footer={
        <View style={{ gap: t.spacing.sm }}>
          {nextId ? (
            <Button
              label="Voir le nouveau rendez-vous"
              size="lg"
              fullWidth
              onPress={() =>
                router.replace({ pathname: '/pro/interventions/[id]', params: { id: nextId } })
              }
              testID="nf-result-next"
            />
          ) : null}
          <Button
            label="Retour à l'intervention"
            size="lg"
            variant={nextId ? 'secondary' : 'primary'}
            fullWidth
            onPress={() => router.back()}
          />
        </View>
      }
      testID="not-feasible-result"
    >
      <Card variant="brand" style={{ gap: t.spacing.md, alignItems: 'center' }}>
        <CheckCircle2 size={48} color={t.colors.tone.success.solid} />
        <Text variant="title2" align="center" accessibilityRole="header">
          {nextId ? 'Nouveau rendez-vous proposé' : 'Intervention annulée'}
        </Text>
        <Text tone="secondary" align="center">
          {nextId
            ? 'Le client est prévenu et doit confirmer la nouvelle date. Elle apparaît dans votre planning.'
            : 'Le client est prévenu avec le motif indiqué.'}{' '}
          Frais de déplacement facturés : {formatEuros(b.price.travelFeeCents)}.
        </Text>
      </Card>
    </Screen>
  );
}
