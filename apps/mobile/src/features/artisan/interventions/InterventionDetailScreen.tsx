import {
  artisanCanSeeExactAddress,
  DOMAIN_LABELS,
  formatEuros,
  RULES,
  type BookingDetailDto,
  type BookingStatus,
} from '@depano/schemas';
import {
  Avatar,
  bookingStatusMeta,
  Button,
  Card,
  ConfirmSheet,
  DomainChip,
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
  type TimelineItem,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import {
  Ban,
  Car,
  DoorOpen,
  FileText,
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
import { Linking, Platform, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { askPermission, getUserPosition } from '@/lib/permissions';
import { useBookingLive } from '@/lib/realtime/hooks';
import { artisanMk, type TransitionVars } from '../mutations';
import { setBookingDetail } from '../queries';
import { distanceKm, useTrackingStore } from '../tracking';

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

/**
 * Détail d'une intervention côté artisan : client, adresse (masquée avant acceptation),
 * navigation + partage de position, appel relais et chat, bouton d'action selon
 * `allowedTransitions`, annulation avec avertissement de fiabilité.
 */
export function InterventionDetailScreen({ id }: { id: string }) {
  const q = useBookingLive(id);
  return (
    <>
      <Stack.Screen
        options={{ title: q.data ? `Intervention ${q.data.reference}` : 'Intervention' }}
      />
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

  const quoteRefused =
    b.status === 'arrived' && (b.quote?.status === 'refused' || b.quote?.status === 'expired');
  const netCents = b.capturedCents != null ? b.capturedCents - (b.commissionCents ?? 0) : null;

  let footer: ReactNode = null;
  const busy = transition.isPending;
  if (can('en_route')) {
    footer = (
      <Button
        label="Y aller"
        icon={Navigation}
        size="lg"
        fullWidth
        loading={busy}
        onPress={() => void goEnRoute()}
        testID="action-en-route"
      />
    );
  } else if (can('arrived')) {
    footer = (
      <View style={{ gap: t.spacing.sm }}>
        <Button
          label="Je suis arrivé"
          icon={DoorOpen}
          size="lg"
          fullWidth
          haptic="success"
          loading={busy}
          onPress={() => void arrived()}
          testID="action-arrived"
        />
        <Button
          label="Itinéraire"
          icon={Navigation}
          variant="ghost"
          fullWidth
          onPress={() => openNavigation(b.address.lat, b.address.lng, addrLabel)}
        />
      </View>
    );
  } else if (can('quote_pending')) {
    footer = (
      <View style={{ gap: t.spacing.sm }}>
        <Button
          label={quoteRefused ? 'Refaire un devis' : 'Faire le devis'}
          icon={FileText}
          size="lg"
          fullWidth
          onPress={() =>
            router.push({ pathname: '/pro/interventions/[id]/devis', params: { id: b.id } })
          }
          testID="action-quote"
        />
        {can('awaiting_code') ? (
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
  } else if (b.status === 'in_progress' && can('awaiting_code')) {
    footer = (
      <Button
        label="Travaux terminés : compte rendu"
        icon={FileText}
        size="lg"
        fullWidth
        onPress={() =>
          router.push({ pathname: '/pro/interventions/[id]/compte-rendu', params: { id: b.id } })
        }
        testID="action-report"
      />
    );
  } else if (b.status === 'awaiting_code') {
    footer = (
      <Button
        label="Saisir le code de fin"
        icon={KeyRound}
        size="lg"
        fullWidth
        disabled={b.completionAttemptsLeft <= 0}
        onPress={() =>
          router.push({ pathname: '/pro/interventions/[id]/code', params: { id: b.id } })
        }
        testID="action-code"
      />
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
              validation.
            </Text>
          </Card>
        ) : null}
        {b.status === 'closed' && netCents != null ? (
          <Card variant="brand" style={{ gap: t.spacing.sm }} testID="closed-summary">
            <Text variant="bodyStrong" tone="success">
              Intervention terminée, paiement capturé
            </Text>
            <PriceRow label="Encaissé" cents={b.capturedCents ?? 0} />
            <PriceRow label="Commission DEPANO" cents={-(b.commissionCents ?? 0)} />
            <PriceRow label="Net pour vous" cents={netCents} total />
          </Card>
        ) : null}

        {/* Client + contact */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Client" />
          <Card style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Avatar name={b.client?.firstName} uri={b.client?.avatarUrl} size={48} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {b.client?.firstName ?? 'Client'}
              </Text>
            </View>
            {addressVisible &&
            !['closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired'].includes(
              b.status,
            ) ? (
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
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
              </View>
            ) : null}
          </Card>
        </View>

        {/* Adresse */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Adresse" />
          <Card style={{ gap: t.spacing.sm }} testID="detail-address">
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
                {!['closed', 'cancelled_by_client', 'cancelled_by_artisan'].includes(b.status) ? (
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
                  {b.address.postalCode} {b.address.city} · adresse exacte visible après
                  acceptation.
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Problème */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Problème signalé" />
          <Card style={{ gap: t.spacing.sm }}>
            <Text variant="bodyStrong">{b.problemReason}</Text>
            {b.problemDescription ? <Text tone="secondary">{b.problemDescription}</Text> : null}
            {b.problemPhotoUrls.length ? (
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
            ) : null}
          </Card>
        </View>

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
            ) : (
              <PriceSummary price={b.price} showRange baseLabel={DOMAIN_LABELS[b.domain]} />
            )}
          </Card>
        </View>

        {/* Historique daté */}
        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Suivi" />
          <Card>
            <Timeline items={timeline(b)} />
          </Card>
        </View>

        {can('cancelled_by_artisan') ? (
          <Button
            label="Annuler l'intervention"
            icon={Ban}
            variant="ghost"
            onPress={() => setCancelOpen(true)}
            testID="action-cancel"
          />
        ) : null}
      </View>

      <ConfirmSheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => cancel.mutate()}
        loading={cancel.isPending}
        tone="danger"
        title="Annuler cette intervention ?"
        message={`Le client sera reprogrammé en priorité avec un autre artisan. Chaque annulation réduit votre score de fiabilité : ${RULES.artisanReliability.maxCancellationsIn30Days} annulations en 30 jours suspendent la réception des urgences.`}
        confirmLabel="Oui, annuler"
        cancelLabel="Garder l'intervention"
      />
    </Screen>
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
            ? 'Appuyez sur « Je suis arrivé » pour prévenir le client.'
            : ok
              ? `Mise à jour toutes les 10 s${lastSentAt ? ` · dernière à ${new Date(lastSentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}.`
              : 'Autorisez la localisation dans les réglages pour que le client suive votre arrivée.'}
        </Text>
      </View>
      {!ok ? null : <Car size={22} color={t.colors.text.secondary} />}
    </Card>
  );
}
