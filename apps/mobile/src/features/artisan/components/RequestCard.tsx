import { formatEuros, RULES, type BookingSummaryDto } from '@depano/schemas';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmSheet,
  DomainChip,
  formatDateTime,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { CalendarClock, Check, Euro, Hourglass, MapPin, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';
import { centsToInput, parseEuros } from '../format';
import { useRespondRequest } from '../queries';

/** Échéance de réponse fournie par l'API, sinon estimée (création + délai, au plus tard l'heure du RDV). */
export function requestExpiry(b: BookingSummaryDto): Date {
  if (b.requestExpiresAt) return new Date(b.requestExpiresAt);
  const ttl = new Date(new Date(b.createdAt).getTime() + RULES.requestTtlHours * 3_600_000);
  return b.scheduledAt && new Date(b.scheduledAt) < ttl ? new Date(b.scheduledAt) : ttl;
}

/** « Répondre avant 14 h 30 » / « Répondre avant le 18 mars 14:30 ». */
function expiryLabel(d: Date): string {
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `Répondre avant ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : `Répondre avant le ${formatDateTime(d)}`;
}

/**
 * Demande de rendez-vous en attente : prénom du client, métier, besoin, créneau, ville (adresse exacte
 * après acceptation), échéance. « Accepter » / « Refuser » ; une demande « Autre » se chiffre d'abord.
 */
export function RequestCard({
  booking: b,
  onPress,
  footer,
}: {
  booking: BookingSummaryDto;
  onPress?: () => void;
  footer?: ReactNode;
}) {
  const t = useTheme();
  const expiry = requestExpiry(b);
  const when = b.scheduledAt ?? b.createdAt;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Demande de rendez-vous de ${b.counterpart?.name ?? 'client'}, ${b.serviceName ?? b.problemReason}, ${formatDateTime(when)}, ${b.city}, ${b.priceOnRequest ? 'prix à proposer' : formatEuros(b.totalCents)}. ${expiryLabel(expiry)}`}
      accessibilityHint={onPress ? 'Ouvre le détail de la demande' : undefined}
      style={{ gap: t.spacing.md, borderWidth: 1, borderColor: t.colors.tone.warning.solid }}
      testID={`request-${b.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Avatar name={b.counterpart?.name} uri={b.counterpart?.avatarUrl} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {b.counterpart?.name ?? 'Client'}
          </Text>
          <DomainChip domain={b.domain} size="sm" />
        </View>
        <Badge label="Demande" tone="warning" />
      </View>
      <Text variant="bodyStrong">{b.serviceName ?? b.problemReason}</Text>
      <View style={{ gap: t.spacing.xs }}>
        <Line icon={<CalendarClock size={16} color={t.colors.text.secondary} />}>
          {formatDateTime(when)}
        </Line>
        <Line icon={<MapPin size={16} color={t.colors.text.secondary} />}>
          {b.city} · adresse exacte après acceptation
        </Line>
        <Line icon={<Euro size={16} color={t.colors.text.secondary} />}>
          {b.priceOnRequest ? 'Prix à proposer (besoin hors catalogue)' : formatEuros(b.totalCents)}
        </Line>
        <Line icon={<Hourglass size={16} color={t.colors.tone.warning.text} />} tone="warning">
          {expiryLabel(expiry)}
        </Line>
      </View>
      {footer}
    </Card>
  );
}

function Line({
  icon,
  children,
  tone = 'secondary',
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: 'secondary' | 'warning';
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
      {icon}
      <Text variant="callout" tone={tone} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** Boutons « Accepter » / « Refuser » d'une demande (confirmation du refus, chiffrage des demandes « Autre »). */
export function RequestActions({
  booking: b,
  onDone,
}: {
  booking: BookingSummaryDto;
  onDone?: (accepted: boolean) => void;
}) {
  const t = useTheme();
  const toast = useToast();
  const respond = useRespondRequest(b.id);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  const accept = () => {
    if (b.priceOnRequest) return setPriceOpen(true);
    respond.mutate(
      { accept: true },
      {
        onSuccess: () => {
          toast.success('Rendez-vous accepté. Il est ajouté à votre planning.');
          onDone?.(true);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      <Button
        label="Refuser"
        icon={X}
        variant="secondary"
        style={{ flex: 1 }}
        disabled={respond.isPending}
        onPress={() => setRefuseOpen(true)}
        testID={`request-refuse-${b.id}`}
      />
      <Button
        label={b.priceOnRequest ? 'Proposer un prix' : 'Accepter'}
        icon={Check}
        style={{ flex: 1 }}
        haptic="success"
        loading={respond.isPending && !refuseOpen && !priceOpen}
        onPress={accept}
        testID={`request-accept-${b.id}`}
      />
      <ConfirmSheet
        visible={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        onConfirm={() =>
          respond.mutate(
            { accept: false },
            {
              onSuccess: () => {
                setRefuseOpen(false);
                toast.show({ message: 'Demande refusée. Le client est prévenu.', type: 'info' });
                onDone?.(false);
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
        loading={respond.isPending}
        tone="danger"
        title="Refuser cette demande ?"
        message={`${b.counterpart?.name ?? 'Le client'} sera prévenu et pourra choisir un autre artisan. Aucun frais.`}
        confirmLabel="Refuser la demande"
        cancelLabel="Retour"
      />
      <PriceProposalSheet
        visible={priceOpen}
        onClose={() => setPriceOpen(false)}
        loading={respond.isPending}
        onSubmit={(v) =>
          respond.mutate(
            { accept: true, ...v },
            {
              onSuccess: () => {
                setPriceOpen(false);
                toast.success(
                  'Prix envoyé. Le rendez-vous est confirmé dès que le client l’accepte.',
                );
                onDone?.(true);
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
    </View>
  );
}

/** « Proposer un prix » pour une demande hors catalogue : le client accepte (en payant) ou refuse. */
function PriceProposalSheet({
  visible,
  onClose,
  onSubmit,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (v: { priceCents: number; durationMinutes?: number; message?: string }) => void;
  loading: boolean;
}) {
  const t = useTheme();
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const cents = parseEuros(price);
    if (cents == null || cents < 100) return setError('Indiquez un prix d’au moins 1 €.');
    if (cents > 1_000_000) return setError(`Prix maximum : ${formatEuros(1_000_000)}.`);
    const minutes = duration.trim() ? Number(duration) : undefined;
    if (minutes != null && (!Number.isInteger(minutes) || minutes < 15 || minutes > 600))
      return setError('Durée entre 15 et 600 minutes.');
    setError(null);
    onSubmit({
      priceCents: cents,
      ...(minutes ? { durationMinutes: minutes } : {}),
      ...(message.trim() ? { message: message.trim() } : {}),
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Proposer un prix"
      description="Le client a décrit un besoin hors catalogue. Il recevra votre prix et devra l’accepter (empreinte bancaire) pour confirmer le rendez-vous."
      footer={
        <Button
          label="Envoyer la proposition"
          size="lg"
          fullWidth
          loading={loading}
          onPress={submit}
          testID="price-proposal-send"
        />
      }
      testID="price-proposal"
    >
      <View style={{ gap: t.spacing.md }}>
        <TextField
          label="Prix de la prestation (€ TTC)"
          value={price}
          onChangeText={setPrice}
          placeholder={centsToInput(12000)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          helper="Hors frais de déplacement, ajoutés automatiquement."
          testID="price-proposal-price"
        />
        <TextField
          label="Durée prévue (minutes, facultatif)"
          value={duration}
          onChangeText={(v) => setDuration(v.replace(/\D/g, '').slice(0, 3))}
          placeholder="60"
          keyboardType="number-pad"
          inputMode="numeric"
          testID="price-proposal-duration"
        />
        <TextField
          label="Message au client (facultatif)"
          value={message}
          onChangeText={setMessage}
          placeholder="Ex. Pièce comprise, prévoir un accès au compteur"
          multiline
          maxLength={500}
          testID="price-proposal-message"
        />
        <Text variant="caption" tone="secondary">
          Un devis détaillé reste obligatoire sur place avant les travaux.
        </Text>
        {error ? (
          <Text tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
