import {
  artisanCanSeeExactAddress,
  DOMAIN_LABELS,
  formatEuros,
  NOT_FEASIBLE_REASON_LABELS,
  RULES,
  type BookingDetailDto,
  type BookingStatus,
} from '@depano/schemas';
import {
  Avatar,
  bookingStatusMeta,
  BottomSheet,
  Button,
  Card,
  ConfirmSheet,
  DomainChip,
  formatDateLong,
  formatDateTime,
  PriceRow,
  PriceSummary,
  Screen,
  SectionHeader,
  SkeletonCard,
  SkeletonText,
  StatusChip,
  Text,
  Timeline,
  useTheme,
  useToast,
  type LucideIcon,
  type TimelineItem,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import {
  Ban,
  Car,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  ClipboardList,
  DoorOpen,
  FileText,
  Hourglass,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Radio,
  Siren,
  TriangleAlert,
  Wallet,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { askPermission, getUserPosition } from '@/lib/permissions';
import { useBookingLive } from '@/lib/realtime/hooks';
import { RequestActions, RequestCard } from '../components/RequestCard';
import { artisanMk, type TransitionVars } from '../mutations';
import { setBookingDetail } from '../queries';
import { distanceKm, useTrackingStore } from '../tracking';
import { ArtisanNoteField } from './ArtisanNoteField';
import {
  canDeclareNotFeasible,
  currentStepLabel,
  interventionNature,
  nextStep,
  quoteRefused as isQuoteRefused,
  statusSteps,
  type StatusStep,
  type StepAction,
} from './status';

/** Ouvre l'itinéraire dans l'app de navigation du téléphone. */
export function openNavigation(lat: number | null, lng: number | null, label: string) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(label);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${dest}&dirflg=d`,
    android: `google.navigation:q=${dest}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
  });
  void Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`),
  );
}

const STEPS: BookingStatus[] = [
  'accepted',
  'en_route',
  'arrived',
  'quote_pending',
  'in_progress',
  'awaiting_code',
  'closed',
];

const ENDED: BookingStatus[] = ['closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired'];

function timeline(b: BookingDetailDto): TimelineItem[] {
  const at = (s: BookingStatus) =>
    [...b.events].reverse().find((e) => e.toStatus === s)?.createdAt ?? null;
  const idx = STEPS.indexOf(b.status);
  if (idx < 0) {
    return [...b.events]
      .sort((x, y) => x.createdAt.localeCompare(y.createdAt))
      .map((e) => ({
        key: e.id,
        label: bookingStatusMeta(e.toStatus, 'artisan').label,
        at: e.createdAt,
        state: 'done' as const,
        note: e.note,
      }));
  }
  return STEPS.map((s, i) => ({
    key: s,
    label: bookingStatusMeta(s, 'artisan').label,
    at: i <= idx ? at(s) : null,
    state: i < idx ? 'done' : i === idx ? 'current' : 'upcoming',
  }));
}

/** Libellé et icône du bouton principal (pied d'écran) pour chaque action du sélecteur de statut. */
const ACTION_BUTTON: Record<StepAction, { label: string; icon: LucideIcon; testID: string }> = {
  en_route: {
    label: 'En route : partager ma position',
    icon: Navigation,
    testID: 'action-en-route',
  },
  arrived: { label: 'Je suis sur place', icon: DoorOpen, testID: 'action-arrived' },
  quote: { label: 'Envoyer le devis', icon: FileText, testID: 'action-quote' },
  report: { label: 'Compte rendu : terminer', icon: ClipboardList, testID: 'action-report' },
  code: { label: 'Saisir le code de fin', icon: KeyRound, testID: 'action-code' },
};

/**
 * Détail d'une intervention côté artisan (maquette « Mes interventions ») : détail rapide, sélecteur
 * « Changer le statut » (En route → Sur place → devis → Intervention en cours), compte rendu (seulement
 * en cours), note personnelle, coordonnées du client (adresse masquée avant acceptation), informations,
 * historique. Demande de RDV : Accepter / Refuser. Non réalisable : frais de déplacement facturés.
 */
export function InterventionDetailScreen({ id }: { id: string }) {
  const q = useBookingLive(id);
  return (
    <>
      <Stack.Screen options={{ title: 'Mes interventions' }} />
      <QueryView
        query={q}
        loading={
          <Screen inTabs>
            <View style={{ gap: 16 }}>
              <SkeletonCard />
              <SkeletonText lines={4} />
              <SkeletonCard />
            </View>
          </Screen>
        }
      >
        {(b) => <Detail b={b} />}
      </QueryView>
    </>
  );
}

function Detail({ b }: { b: BookingDetailDto }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const tracking = useTrackingStore();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const transition = useMutation<BookingDetailDto, Error, TransitionVars>({
    mutationKey: artisanMk.transition,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => api.bookings.cancel(b.id, { reason: 'Annulée par l’artisan' }),
    onSuccess: (nb) => {
      setBookingDetail(qc, nb);
      setCancelOpen(false);
      toast.show({
        message: 'Intervention annulée. Le client est reprogrammé en priorité.',
        type: 'info',
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const call = useMutation({
    mutationFn: () => api.bookings.callRelay(b.id),
    onSuccess: (r) =>
      void Linking.openURL(`tel:${r.phoneNumber.replace(/\s/g, '')}`).catch(() =>
        toast.show({ message: `Composez le ${r.phoneNumber}`, type: 'info' }),
      ),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const can = (s: BookingStatus) => b.allowedTransitions.includes(s);
  const addressVisible = artisanCanSeeExactAddress(b.status) && !!b.address.line1;
  const addrLabel = [b.address.line1, `${b.address.postalCode} ${b.address.city}`]
    .filter(Boolean)
    .join(', ');
  const destLat = b.address.lat ?? b.address.approxLat;
  const destLng = b.address.lng ?? b.address.approxLng;
  const near =
    b.status === 'en_route' && tracking.bookingId === b.id && tracking.last
      ? distanceKm(tracking.last, { lat: destLat, lng: destLng }) < 0.15
      : false;
  const ended = ENDED.includes(b.status);

  const goEnRoute = async () => {
    const granted = await askPermission(
      'location',
      'Pour indiquer au client votre trajet et votre heure d’arrivée',
    );
    const pos = granted ? await getUserPosition() : null;
    openNavigation(b.address.lat, b.address.lng, addrLabel);
    transition.mutate({
      bookingId: b.id,
      to: 'en_route',
      ...(pos && !pos.approximate ? { lat: pos.lat, lng: pos.lng } : {}),
    });
  };
  const arrived = async () => {
    const pos = await getUserPosition();
    transition.mutate({
      bookingId: b.id,
      to: 'arrived',
      ...(!pos.approximate ? { lat: pos.lat, lng: pos.lng } : {}),
    });
  };
  const run = (a: StepAction) => {
    setStatusOpen(false);
    switch (a) {
      case 'en_route':
        return void goEnRoute();
      case 'arrived':
        return void arrived();
      case 'quote':
        return router.push({ pathname: '/pro/interventions/[id]/devis', params: { id: b.id } });
      case 'report':
        return router.push({
          pathname: '/pro/interventions/[id]/compte-rendu',
          params: { id: b.id },
        });
      case 'code':
        return router.push({ pathname: '/pro/interventions/[id]/code', params: { id: b.id } });
    }
  };

  const quoteRefused = isQuoteRefused(b);
  const steps = statusSteps(b);
  const next = nextStep(b);
  const netCents = b.capturedCents != null ? b.capturedCents - (b.commissionCents ?? 0) : null;
  const priceCents = b.quote?.status === 'accepted' ? b.quote.totalCents : b.totalCents;
  const waitingClient = b.status === 'pending_payment' && b.artisanAccepted;

  let footer: ReactNode = null;
  if (next?.action) {
    const a = ACTION_BUTTON[next.action];
    footer = (
      <View style={{ gap: t.spacing.sm }}>
        <Button
          label={next.action === 'quote' ? next.label : a.label}
          icon={a.icon}
          size="lg"
          fullWidth
          haptic={next.action === 'arrived' ? 'success' : undefined}
          loading={transition.isPending}
          onPress={() => run(next.action!)}
          testID={a.testID}
        />
        {b.status === 'en_route' ? (
          <Button
            label="Itinéraire"
            icon={Navigation}
            variant="ghost"
            fullWidth
            onPress={() => openNavigation(b.address.lat, b.address.lng, addrLabel)}
          />
        ) : null}
        {quoteRefused && can('awaiting_code') ? (
          <Button
            label="Déplacement seulement"
            variant="ghost"
            fullWidth
            onPress={() =>
              router.push({
                pathname: '/pro/interventions/[id]/compte-rendu',
                params: { id: b.id, deplacement: '1' },
              })
            }
            testID="action-travel-only"
          />
        ) : null}
      </View>
    );
  } else if (b.status === 'closed') {
    footer = (
      <Button
        label="Voir mes revenus"
        icon={Wallet}
        size="lg"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/pro/profil/revenus')}
      />
    );
  }

  return (
    <Screen inTabs footer={footer} testID="intervention-detail">
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            <StatusChip status={b.status} perspective="artisan" />
            {b.kind === 'urgent' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Siren size={16} color={t.colors.tone.urgent.text} />
                <Text variant="label" tone="urgent">
                  Urgence
                </Text>
              </View>
            ) : (
              <Text variant="label" tone="secondary">
                Rendez-vous {b.scheduledAt ? `· ${formatDateTime(b.scheduledAt)}` : ''}
              </Text>
            )}
          </View>
          <Text
            variant="title1"
            accessibilityRole="header"
            testID="detail-status"
            accessibilityLabel={`${b.problemReason}. Statut : ${bookingStatusMeta(b.status, 'artisan').label}`}
          >
            {b.serviceName ?? b.problemReason}
          </Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <DomainChip domain={b.domain} size="sm" />
            <Text variant="caption" tone="secondary">
              Réf. {b.reference}
            </Text>
          </View>
        </View>

        {b.status === 'requested' ? (
          <RequestCard booking={b} footer={<RequestActions booking={b} />} />
        ) : null}
        {waitingClient ? (
          <Card variant="brand" style={{ gap: t.spacing.xs }} testID="waiting-client">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Hourglass size={20} color={t.colors.tone.info.text} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                En attente de confirmation du client
              </Text>
            </View>
            <Text variant="callout" tone="secondary">
              {b.priceOnRequest
                ? `Prix proposé : ${formatEuros(b.totalCents)}. Le rendez-vous est confirmé dès que le client l’accepte.`
                : 'Le client valide le paiement pour confirmer ce rendez-vous.'}
            </Text>
          </Card>
        ) : null}
        {b.notFeasible ? <NotFeasibleSummary b={b} /> : null}
        {b.status === 'en_route' ? <TrackingBanner near={near} /> : null}
        {quoteRefused ? (
          <Card
            variant="outline"
            style={{ gap: t.spacing.xs, borderColor: t.colors.tone.danger.solid }}
            testID="quote-refused"
          >
            <Text variant="bodyStrong" tone="danger">
              {b.quote?.status === 'expired' ? 'Devis expiré' : 'Devis refusé par le client'}
            </Text>
            <Text variant="callout" tone="secondary">
              Proposez un nouveau devis, ou clôturez en « Déplacement seulement » : seuls les frais
              de déplacement seront facturés.
            </Text>
          </Card>
        ) : null}
        {b.status === 'quote_pending' ? (
          <Card variant="brand" style={{ gap: t.spacing.xs }} testID="quote-waiting">
            <Text variant="bodyStrong">Devis envoyé : {formatEuros(b.quote?.totalCents ?? 0)}</Text>
            <Text variant="callout" tone="secondary">
              Le client le valide dans son application. Ne commencez pas les travaux avant sa
              validation : le statut passera alors à « Intervention en cours ».
            </Text>
          </Card>
        ) : null}
        {b.status === 'closed' && netCents != null ? (
          <Card variant="brand" style={{ gap: t.spacing.sm }} testID="closed-summary">
            <Text variant="bodyStrong" tone="success">
              Intervention terminée, paiement capturé
            </Text>
            {/* Montant net uniquement : la commission n'est pas détaillée à l'artisan (taux dans l'Aide). */}
            <PriceRow label="Net pour vous" cents={netCents} total />
          </Card>
        ) : null}

        {/* Détail rapide */}
        <Card style={{ gap: t.spacing.sm }} testID="quick-detail">
          <Text variant="bodyStrong" accessibilityRole="header">
            Détail rapide d’intervention
          </Text>
          <Field label="Description">
            {[b.problemReason, b.problemDescription].filter(Boolean).join(' · ')}
          </Field>
          <Field label="Nature">{interventionNature(b)}</Field>
          <Field label="Adresse">
            {addressVisible
              ? addrLabel
              : `${b.address.postalCode} ${b.address.city} (adresse exacte après acceptation)`}
          </Field>
          <Field label={b.quote?.status === 'accepted' ? 'Tarif facturé' : 'Tarif annoncé'}>
            {b.priceOnRequest && !b.artisanAccepted ? 'À proposer' : formatEuros(priceCents)}
          </Field>
          <Field label="Client">{b.client?.firstName ?? 'Client'}</Field>
        </Card>

        {/* Changer le statut */}
        {steps.length && !ended ? (
          <StatusControl
            b={b}
            onOpen={() => setStatusOpen(true)}
            onNotFeasible={
              canDeclareNotFeasible(b)
                ? () =>
                    router.push({
                      pathname: '/pro/interventions/[id]/non-realisable',
                      params: { id: b.id },
                    })
                : undefined
            }
          />
        ) : null}

        {/* Compte rendu : seulement intervention en cours */}
        {steps.length && b.status !== 'closed' ? (
          <Card style={{ gap: t.spacing.sm }} testID="report-row">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                Compte rendu
              </Text>
              {b.status === 'awaiting_code' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
                  <CheckCircle2 size={18} color={t.colors.tone.success.text} />
                  <Text variant="label" tone="success">
                    Envoyé
                  </Text>
                </View>
              ) : (
                <Button
                  label="Démarrer"
                  size="sm"
                  variant={b.status === 'in_progress' ? 'primary' : 'secondary'}
                  disabled={!(b.status === 'in_progress' && can('awaiting_code'))}
                  accessibilityHint={
                    b.status === 'in_progress'
                      ? 'Ouvre le questionnaire de fin d’intervention'
                      : 'Disponible quand l’intervention est en cours'
                  }
                  onPress={() => run('report')}
                  testID="report-start"
                />
              )}
            </View>
            {b.status !== 'in_progress' && b.status !== 'awaiting_code' ? (
              <Text variant="callout" tone="secondary">
                Disponible une fois le devis validé par le client et l’intervention en cours.
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* Note personnelle */}
        {!['cancelled_by_client', 'cancelled_by_artisan', 'expired'].includes(b.status) ? (
          <Card>
            <ArtisanNoteField bookingId={b.id} note={b.artisanNote} />
          </Card>
        ) : null}

        {/* Coordonnées client */}
        <Card style={{ gap: t.spacing.md }} testID="detail-address">
          <Text variant="bodyStrong" accessibilityRole="header">
            Coordonnées client
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <Avatar name={b.client?.firstName} uri={b.client?.avatarUrl} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Field label="Nom">{b.client?.firstName ?? 'Client'}</Field>
              <Field label="Ville">{b.address.city}</Field>
            </View>
          </View>
          {addressVisible ? (
            <>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <MapPin size={20} color={t.colors.text.brand} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{b.address.line1}</Text>
                  <Text tone="secondary">
                    {b.address.postalCode} {b.address.city}
                  </Text>
                </View>
              </View>
              {[
                b.address.floor ? `Étage : ${b.address.floor}` : null,
                b.address.doorCode ? `Code porte : ${b.address.doorCode}` : null,
                b.address.accessNotes,
              ]
                .filter(Boolean)
                .map((l) => (
                  <Text key={l!} variant="callout">
                    {l}
                  </Text>
                ))}
              {!ended ? (
                <Button
                  label="Ouvrir dans Maps"
                  icon={Navigation}
                  variant="ghost"
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => openNavigation(b.address.lat, b.address.lng, addrLabel)}
                />
              ) : null}
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Lock size={20} color={t.colors.text.secondary} />
              <Text tone="secondary" style={{ flex: 1 }}>
                {b.address.postalCode} {b.address.city} · adresse exacte visible après acceptation.
              </Text>
            </View>
          )}
          {addressVisible && !ended ? (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {b.conversationId ? (
                <Button
                  label="Message"
                  icon={MessageCircle}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({
                      pathname: '/pro/messages/[id]',
                      params: { id: b.conversationId! },
                    })
                  }
                  testID="chat-client"
                />
              ) : null}
              <Button
                label="Appeler"
                icon={Phone}
                variant="secondary"
                style={{ flex: 1 }}
                loading={call.isPending}
                onPress={() => call.mutate()}
                accessibilityHint="Appel via un numéro relais : vos numéros restent masqués"
                testID="call-client"
              />
            </View>
          ) : null}
        </Card>

        {/* Information intervention */}
        <Card style={{ gap: t.spacing.sm }}>
          <Text variant="bodyStrong" accessibilityRole="header">
            Information intervention
          </Text>
          <Field label="Statut">{bookingStatusMeta(b.status, 'artisan').label}</Field>
          <Field label="RDV pris le">{formatDateLong(b.createdAt)}</Field>
          {b.scheduledAt ? (
            <Field label="Date du RDV">{formatDateTime(b.scheduledAt)}</Field>
          ) : null}
          {b.rescheduledFromId ? <Field label="Origine">Rendez-vous reprogrammé</Field> : null}
          <Field label="Référence">{b.reference}</Field>
        </Card>

        {/* Photos du client */}
        {b.problemPhotoUrls.length ? (
          <View style={{ gap: t.spacing.sm }}>
            <SectionHeader title="Photos du client" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {b.problemPhotoUrls.map((u, i) => (
                <Image
                  key={u}
                  source={{ uri: u }}
                  style={{ width: 96, height: 96, borderRadius: t.radius.md }}
                  accessibilityLabel={`Photo du client ${i + 1}`}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Prix */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader
            title={b.quote?.status === 'accepted' ? 'Devis accepté' : 'Prix annoncé au client'}
          />
          <Card>
            {b.quote?.status === 'accepted' ? (
              <View style={{ gap: t.spacing.sm }}>
                {b.quote.lines.map((l) => (
                  <PriceRow
                    key={l.id}
                    label={`${l.label}${l.quantity !== 1 ? ` × ${String(l.quantity).replace('.', ',')}` : ''}`}
                    cents={l.totalCents}
                  />
                ))}
                <PriceRow label="Total TTC" cents={b.quote.totalCents} total />
              </View>
            ) : b.priceOnRequest && !b.artisanAccepted ? (
              <Text tone="secondary">
                Besoin hors catalogue : proposez un prix en acceptant la demande.
              </Text>
            ) : (
              <PriceSummary price={b.price} showRange baseLabel={DOMAIN_LABELS[b.domain]} />
            )}
          </Card>
        </View>

        {/* Historique daté */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Historique de l’intervention" />
          <Card>
            <Timeline items={timeline(b)} />
          </Card>
        </View>

        {can('cancelled_by_artisan') && b.status !== 'requested' ? (
          <Button
            label="Annuler l'intervention"
            icon={Ban}
            variant="ghost"
            onPress={() => setCancelOpen(true)}
            testID="action-cancel"
          />
        ) : null}
      </View>

      <StatusSheet
        visible={statusOpen}
        onClose={() => setStatusOpen(false)}
        steps={steps}
        busy={transition.isPending}
        onRun={run}
      />
      <ConfirmSheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        tone="danger"
        title="Annuler cette intervention ?"
        message={`Le client sera reprogrammé en priorité avec un autre artisan. Chaque annulation réduit votre score de fiabilité : ${RULES.artisanReliability.maxCancellationsIn30Days} annulations en 30 jours suspendent la réception ${features.urgent ? 'des urgences' : 'de nouvelles demandes'}.`}
        confirmLabel="Oui, annuler"
        cancelLabel="Garder l'intervention"
      />
    </Screen>
  );
}

/** Ligne « Libellé : valeur » des cartes de la maquette. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Text variant="callout">
      <Text variant="label">{label} : </Text>
      {children}
    </Text>
  );
}

/**
 * Sélecteur « Changer le statut » : pastille de l'état courant ; un tap ouvre les étapes du parcours
 * (la suivante est activable, les autres expliquent pourquoi elles ne le sont pas).
 */
function StatusControl({
  b,
  onOpen,
  onNotFeasible,
}: {
  b: BookingDetailDto;
  onOpen: () => void;
  onNotFeasible?: () => void;
}) {
  const t = useTheme();
  const label = currentStepLabel(b) ?? bookingStatusMeta(b.status, 'artisan').label;
  const next = nextStep(b);
  const active = ['en_route', 'arrived', 'quote_pending', 'in_progress'].includes(b.status);
  return (
    <Card style={{ gap: t.spacing.md }} testID="status-control">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Changer le statut. Statut actuel : ${label}${next ? `. Étape suivante : ${next.label}` : ''}`}
        onPress={onOpen}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: 48 }}
        testID="status-control-open"
      >
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          Changer le statut
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.xs,
            borderRadius: t.radius.full,
            backgroundColor: active ? t.colors.tone.success.soft : t.colors.background.subtle,
          }}
        >
          <Text
            variant="label"
            tone={active ? 'success' : 'primary'}
            testID="status-control-current"
          >
            {label}
          </Text>
          <ChevronDown
            size={16}
            color={active ? t.colors.tone.success.text : t.colors.text.primary}
          />
        </View>
      </Pressable>
      {next ? (
        <Text variant="callout" tone="secondary">
          Étape suivante : {next.label}
        </Text>
      ) : b.status === 'quote_pending' ? (
        <Text variant="callout" tone="secondary">
          En attente de la validation du devis par le client.
        </Text>
      ) : null}
      {onNotFeasible ? (
        <Button
          label="Intervention non réalisable"
          icon={TriangleAlert}
          variant="ghost"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          accessibilityHint="Client absent, accès impossible… Les frais de déplacement restent facturés"
          onPress={onNotFeasible}
          testID="action-not-feasible"
        />
      ) : null}
    </Card>
  );
}

function StatusSheet({
  visible,
  onClose,
  steps,
  busy,
  onRun,
}: {
  visible: boolean;
  onClose: () => void;
  steps: StatusStep[];
  busy: boolean;
  onRun: (a: StepAction) => void;
}) {
  const t = useTheme();
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Changer le statut"
      description="Le client suit chaque étape en direct. Le devis validé par le client est obligatoire avant les travaux."
      testID="status-sheet"
    >
      <View style={{ gap: t.spacing.sm }}>
        {steps.map((s) => {
          const Icon =
            s.state === 'done' ? CheckCircle2 : s.state === 'current' ? CircleDot : Circle;
          const color =
            s.state === 'done'
              ? t.colors.tone.success.text
              : s.state === 'current'
                ? t.colors.text.brand
                : t.colors.text.secondary;
          const stateLabel =
            s.state === 'done'
              ? 'fait'
              : s.state === 'current'
                ? 'statut actuel'
                : s.action
                  ? 'disponible'
                  : 'à venir';
          return (
            <View
              key={s.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                minHeight: 48,
              }}
              accessible={!s.action}
              accessibilityLabel={
                !s.action ? `${s.label}, ${stateLabel}${s.hint ? `. ${s.hint}` : ''}` : undefined
              }
            >
              <Icon size={22} color={color} />
              {s.action ? (
                <Button
                  label={s.label}
                  style={{ flex: 1 }}
                  loading={busy}
                  onPress={() => onRun(s.action!)}
                  testID={`status-step-${s.key}`}
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <Text
                    variant={s.state === 'current' ? 'bodyStrong' : 'body'}
                    tone={s.state === 'upcoming' || s.state === 'next' ? 'secondary' : 'primary'}
                  >
                    {s.label}
                  </Text>
                  {s.hint && s.state !== 'done' && s.state !== 'current' ? (
                    <Text variant="caption" tone="secondary">
                      {s.hint}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </BottomSheet>
  );
}

/** Intervention déclarée non réalisable : motif, frais de déplacement, nouveau RDV éventuel. */
function NotFeasibleSummary({ b }: { b: BookingDetailDto }) {
  const t = useTheme();
  const nf = b.notFeasible!;
  return (
    <Card
      variant="outline"
      style={{ gap: t.spacing.sm, borderColor: t.colors.tone.warning.solid }}
      testID="not-feasible-summary"
    >
      <Text variant="bodyStrong">Intervention non réalisable</Text>
      <Text variant="callout">
        Motif : {NOT_FEASIBLE_REASON_LABELS[nf.reason]}
        {nf.comment ? ` · ${nf.comment}` : ''}
      </Text>
      <Text variant="callout" tone="secondary">
        Frais de déplacement facturés : {formatEuros(b.price.travelFeeCents)}.
      </Text>
      {nf.rescheduledBookingId ? (
        <Button
          label="Voir le nouveau rendez-vous"
          variant="secondary"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          onPress={() =>
            router.push({
              pathname: '/pro/interventions/[id]',
              params: { id: nf.rescheduledBookingId! },
            })
          }
          testID="rescheduled-booking"
        />
      ) : null}
    </Card>
  );
}

function TrackingBanner({ near }: { near: boolean }) {
  const t = useTheme();
  const state = useTrackingStore((s) => s.state);
  const lastSentAt = useTrackingStore((s) => s.lastSentAt);
  const ok = state === 'sharing' || state === 'starting';
  return (
    <Card
      variant={near ? 'brand' : 'flat'}
      style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}
      testID="tracking-banner"
    >
      {ok ? (
        <Radio size={22} color={t.colors.tone.success.solid} />
      ) : (
        <TriangleAlert size={22} color={t.colors.tone.warning.solid} />
      )}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">
          {near
            ? 'Vous semblez arrivé'
            : ok
              ? 'Position partagée avec le client'
              : 'Position non partagée'}
        </Text>
        <Text variant="callout" tone="secondary">
          {near
            ? 'Appuyez sur « Je suis sur place » pour prévenir le client.'
            : ok
              ? `Mise à jour toutes les 10 s${lastSentAt ? ` · dernière à ${new Date(lastSentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}.`
              : 'Autorisez la localisation dans les réglages pour que le client suive votre arrivée.'}
        </Text>
      </View>
      {!ok ? null : <Car size={22} color={t.colors.text.secondary} />}
    </Card>
  );
}
