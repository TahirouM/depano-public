import { ApiError, formatEuros, RULES, type UrgentOfferDto } from '@depano/schemas';
import {
  Button,
  Card,
  DomainChip,
  EmptyState,
  ErrorState,
  formatDistance,
  haptic,
  Screen,
  Skeleton,
  SkeletonText,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Redirect, router, Stack } from 'expo-router';
import { Check, Clock, MapPin, UserX, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api, errorMessage, isNetworkError } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useRealtimeEvent } from '@/lib/realtime/hooks';
import { CountdownRing } from '../components/CountdownRing';
import { useCountdown } from '../components/OfferCard';
import { setBookingDetail, useOffer } from '../queries';

type Gone = 'taken' | 'expired' | 'cancelled' | 'declined' | null;

const GONE_COPY: Record<Exclude<Gone, null>, { title: string; message: string }> = {
  taken: {
    title: 'Prise par un autre artisan',
    message:
      'Un artisan plus rapide a accepté cette urgence. La prochaine sera peut-être pour vous !',
  },
  expired: {
    title: 'Délai écoulé',
    message: 'Le temps pour répondre est passé. La demande a été proposée à un autre artisan.',
  },
  cancelled: { title: 'Demande annulée', message: 'Le client a annulé sa demande.' },
  declined: {
    title: 'Demande refusée',
    message: 'Pas de souci : cela n’affecte pas votre fiabilité.',
  },
};

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/pro/accueil');
}

/**
 * Demande d'urgence plein écran : motif, photos, distance, gain net, compte à rebours 60 s,
 * Accepter / Refuser en bas (une main), haptique, état « prise par un autre » (offer.revoked).
 */
export function OfferScreen({ offerId }: { offerId: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useOffer(offerId);
  const [gone, setGone] = useState<Gone>(null);
  const offer: UrgentOfferDto | undefined = query.data;
  const left = useCountdown(offer?.expiresAt);
  const buzzed = useRef(false);

  // Retour haptique à l'ouverture : l'artisan a souvent le téléphone dans la poche.
  useEffect(() => {
    if (offer && !buzzed.current) {
      buzzed.current = true;
      haptic('warning');
    }
  }, [offer]);

  useRealtimeEvent('offer.revoked', (e) => {
    if (e.offerId === offerId || (offer && e.bookingId === offer.bookingId)) {
      haptic('error');
      setGone(e.reason);
      void qc.invalidateQueries({ queryKey: qk.artisan.offer(offerId) });
    }
  });

  useEffect(() => {
    // On relit l'échéance (le compteur peut valoir 0 au premier rendu, avant son effet).
    if (offer && left === 0 && !gone && new Date(offer.expiresAt).getTime() <= Date.now())
      setGone('expired');
  }, [left, offer, gone]);

  const accept = useMutation({
    mutationFn: () => api.artisan.acceptOffer(offerId),
    onSuccess: (b) => {
      setBookingDetail(qc, b);
      void qc.invalidateQueries({ queryKey: qk.artisan.offers });
      toast.success('Urgence acceptée. Le client est prévenu.');
      router.replace({ pathname: '/pro/interventions/[id]', params: { id: b.id } });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'offer_taken') setGone('taken');
      else if (e instanceof ApiError && e.code === 'offer_expired') setGone('expired');
      else toast.error(errorMessage(e));
    },
  });

  const decline = useMutation({
    mutationFn: () => api.artisan.declineOffer(offerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.artisan.offers });
      void qc.invalidateQueries({ queryKey: qk.artisan.dashboard });
      close();
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.status === 410 || e.status === 409)) close();
      else toast.error(errorMessage(e));
    },
  });

  const header = (
    <Stack.Screen
      options={{
        title: "Demande d'urgence",
        headerLeft: () => <Button label="Fermer" variant="ghost" size="sm" onPress={close} />,
      }}
    />
  );

  // Offre déjà acceptée par cet artisan (réouverture depuis la notification) : on file vers l'intervention.
  if (!gone && offer?.status === 'accepted' && !accept.isPending) {
    return <Redirect href={{ pathname: '/pro/interventions/[id]', params: { id: offer.bookingId } }} />;
  }

  if (gone || (offer && offer.status !== 'pending')) {
    const fromStatus: Exclude<Gone, null> =
      offer?.status === 'taken' || offer?.status === 'declined' ? offer.status : 'expired';
    const g = GONE_COPY[gone ?? fromStatus];
    return (
      <Screen
        footer={
          <Button
            label="Retour à l'accueil"
            size="lg"
            fullWidth
            onPress={close}
            testID="offer-gone-close"
          />
        }
      >
        {header}
        <EmptyState
          fill
          icon={gone === 'taken' ? UserX : Clock}
          title={g.title}
          message={g.message}
        />
      </Screen>
    );
  }

  if (!offer) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 403);
    if (query.isError && !notFound) {
      return (
        <Screen>
          {header}
          <ErrorState
            offline={isNetworkError(query.error)}
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </Screen>
      );
    }
    if (query.isPending || (query.isFetching && !query.isError)) {
      return (
        <Screen>
          {header}
          <View style={{ gap: t.spacing.lg, alignItems: 'center' }}>
            <Skeleton width={132} height={132} radius={66} />
            <SkeletonText lines={4} />
          </View>
        </Screen>
      );
    }
    return (
      <Screen footer={<Button label="Retour à l'accueil" size="lg" fullWidth onPress={close} />}>
        {header}
        <EmptyState
          fill
          icon={Clock}
          title="Demande plus disponible"
          message="Cette urgence a déjà été attribuée ou a expiré."
        />
      </Screen>
    );
  }

  return (
    <Screen
      background="surface"
      footer={
        <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
          <Button
            label="Refuser"
            icon={X}
            variant="secondary"
            size="lg"
            style={{ flex: 1 }}
            loading={decline.isPending}
            disabled={accept.isPending}
            onPress={() => decline.mutate()}
            testID="offer-decline"
          />
          <Button
            label="Accepter"
            icon={Check}
            size="lg"
            haptic="success"
            style={{ flex: 2, minHeight: 64 }}
            loading={accept.isPending}
            disabled={decline.isPending}
            onPress={() => accept.mutate()}
            testID="offer-accept"
          />
        </View>
      }
      testID="offer-screen"
    >
      {header}
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <CountdownRing remaining={left} total={RULES.dispatch.offerTimeoutSeconds} />
          <Text variant="callout" tone="secondary" align="center">
            Le premier artisan qui accepte obtient l'intervention.
          </Text>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <DomainChip domain={offer.domain} />
          <Text variant="title1" accessibilityRole="header" testID="offer-reason">
            {offer.problemReason}
          </Text>
          {offer.problemDescription ? (
            <Text tone="secondary">{offer.problemDescription}</Text>
          ) : null}
        </View>

        {offer.problemPhotoUrls.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: t.spacing.sm }}
          >
            {offer.problemPhotoUrls.map((u, i) => (
              <Image
                key={u}
                source={{ uri: u }}
                style={{ width: 140, height: 140, borderRadius: t.radius.md }}
                contentFit="cover"
                accessibilityLabel={`Photo du problème ${i + 1}`}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <Card
            variant="flat"
            style={{ flex: 1, gap: 4 }}
            accessibilityLabel={`Distance : ${formatDistance(offer.distanceKm)}, ${offer.city}`}
          >
            <MapPin size={20} color={t.colors.text.brand} />
            <Text variant="title2">{formatDistance(offer.distanceKm)}</Text>
            <Text variant="caption" tone="secondary">
              {offer.city} · adresse exacte après acceptation
            </Text>
          </Card>
          <Card
            variant="brand"
            style={{ flex: 1, gap: 4 }}
            accessibilityLabel={`Gain net estimé : ${formatEuros(offer.estimatedEarningsCents)}`}
          >
            <Text variant="caption" tone="secondary">
              Gain net estimé
            </Text>
            <Text variant="title1" tone="success" testID="offer-earnings">
              {formatEuros(offer.estimatedEarningsCents)}
            </Text>
            <Text variant="caption" tone="secondary">
              Client : {formatEuros(offer.totalCents)} TTC
            </Text>
          </Card>
        </View>
        <Text variant="caption" tone="secondary">
          Devis obligatoire sur place avant tout travail. Paiement garanti : l'empreinte bancaire du
          client est déjà prise.
        </Text>
      </View>
    </Screen>
  );
}
