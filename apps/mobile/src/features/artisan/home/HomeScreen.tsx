import { formatEuros, type ArtisanDashboardDto, type UrgentOfferDto } from '@depano/schemas';
import {
  Card,
  haptic,
  Icon,
  InterventionCard,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  StaggerItem,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarCheck, Coffee, Euro, MapPin, Wrench, Zap, ZapOff } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { HeaderBell } from '@/components/HeaderBell';
import { QueryView } from '@/components/QueryView';
import { HeroSheetLayout } from '@/features/client/components/HeroSheetLayout';
import { api, errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { getPermissionState, getUserPosition } from '@/lib/permissions';
import { useMe } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { AccountStatusCard } from '../components/AccountStatusCard';
import { ArtisanBookingCard } from '../components/ArtisanBookingCard';
import { OfferCard } from '../components/OfferCard';
import { useArtisanProfile, useDashboard } from '../queries';

/** Rafraîchit la position envoyée au dispatch tant que l'artisan est disponible. */
const POSITION_REFRESH_MS = 5 * 60_000;
/** Écart entre les deux vibrations signalant une nouvelle urgence. */
const NEW_OFFER_SECOND_BUZZ_MS = 180;

/**
 * Nouvelles urgences arrivées pendant que l'accueil est affiché : double vibration « warning »
 * et liste des identifiants à faire pulser. La première liste chargée sert de référence (déjà
 * connues) : un simple rafraîchissement ne redéclenche rien. Une urgence cesse de pulser quand
 * l'artisan l'ouvre ; acceptée, refusée ou retirée, elle disparaît de la liste ; expirée, la carte
 * coupe elle-même l'animation.
 */
export function useNewOfferAlert(offers: UrgentOfferDto[] | undefined) {
  const seen = useRef<Set<string> | null>(null);
  const buzz = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!offers) return;
    if (!seen.current) {
      seen.current = new Set(offers.map((o) => o.id));
      return;
    }
    const known = seen.current;
    const added = offers.filter((o) => !known.has(o.id)).map((o) => o.id);
    if (!added.length) return;
    added.forEach((id) => known.add(id));
    setFresh((prev) => new Set([...prev, ...added]));
    haptic('warning');
    if (buzz.current) clearTimeout(buzz.current);
    buzz.current = setTimeout(() => haptic('warning'), NEW_OFFER_SECOND_BUZZ_MS);
  }, [offers]);

  useEffect(
    () => () => {
      if (buzz.current) clearTimeout(buzz.current);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setFresh((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { fresh, dismiss };
}

/**
 * Accueil artisan, même habillage que l'accueil client : en-tête fixe (zone, cloche, « Bonjour Karim »,
 * résumé du jour) et feuille de contenu (demandes de rendez-vous en attente, prochaine intervention,
 * résumé du jour, à venir). État « compte non validé ».
 * Urgences (`features.urgent`) : interrupteur « Disponible pour urgences » et urgences en attente,
 * masqués tant que la fonctionnalité est désactivée (code conservé).
 */
export function HomeScreen() {
  const t = useTheme();
  const dash = useDashboard();
  const me = useMe();
  // Zone affichée dans la barre du haut (et motif de refus pour un compte non validé).
  const profile = useArtisanProfile({ enabled: !!me.data?.artisan });
  const d = dash.data;
  // Urgences masquées tant que la fonctionnalité est désactivée : pas d'alerte non plus.
  const newOffers = useNewOfferAlert(features.urgent ? d?.pendingOffers : undefined);

  return (
    <HeroSheetLayout
      testID="pro-home"
      refreshing={dash.isRefetching}
      onRefresh={() => void dash.refetch()}
      topBar={
        <>
          {profile.data?.baseCity ? (
            <Pressable
              onPress={() => router.push('/pro/profil/disponibilites')}
              accessibilityRole="button"
              accessibilityLabel={`Zone d'intervention : ${profile.data.baseCity}, ${profile.data.radiusKm} kilomètres`}
              accessibilityHint="Modifier votre zone et vos horaires"
              hitSlop={4}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                minHeight: 44,
                marginLeft: t.spacing.sm,
                opacity: pressed ? 0.7 : 1,
              })}
              testID="pro-home-zone"
            >
              <Icon icon={MapPin} size={18} color={t.colors.text.brand} />
              <Text variant="bodyStrong" numberOfLines={1}>
                {profile.data.baseCity}
              </Text>
              <Text variant="callout" tone="secondary">
                · {profile.data.radiusKm} km
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <HeaderBell />
        </>
      }
      hero={
        <View style={{ gap: t.spacing.sm, maxWidth: 360 }}>
          <DateChip />
          <Greeting firstName={me.data?.firstName} />
          <Text tone="secondary" style={{ maxWidth: 300 }} testID="pro-home-summary">
            {d ? daySummary(d) : ' '}
          </Text>
        </View>
      }
    >
      <QueryView query={dash} loading={<HomeSkeleton />}>
        {(d) => (
          <View style={{ gap: t.spacing.xl }}>
            {d.status !== 'approved' ? (
              <AccountStatusCard status={d.status} reason={profile.data?.rejectionReason} />
            ) : null}
            {features.urgent ? <AvailabilityToggle dashboard={d} /> : null}

            {features.urgent && d.pendingOffers.length ? (
              <View style={{ gap: t.spacing.sm }}>
                <SectionHeader title={`Urgences en attente (${d.pendingOffers.length})`} />
                {d.pendingOffers.map((o, i) => (
                  <StaggerItem key={o.id} index={i}>
                    <OfferCard
                      offer={o}
                      pulse={newOffers.fresh.has(o.id)}
                      onPress={() => {
                        newOffers.dismiss(o.id);
                        router.push({ pathname: '/pro/offre/[id]', params: { id: o.id } });
                      }}
                    />
                  </StaggerItem>
                ))}
              </View>
            ) : null}

            {/* Tableau de bord antérieur à l'API des demandes : champ absent. */}
            {d.pendingRequests?.length ? (
              <View style={{ gap: t.spacing.sm }} testID="pending-requests">
                <SectionHeader title={`Demandes de rendez-vous (${d.pendingRequests.length})`} />
                {d.pendingRequests.map((b, i) => (
                  <StaggerItem key={b.id} index={i}>
                    <ArtisanBookingCard booking={b} />
                  </StaggerItem>
                ))}
              </View>
            ) : null}

            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader
                title="Prochaine intervention"
                action={{ label: 'Planning', onPress: () => router.push('/pro/planning') }}
              />
              {d.next ? (
                <InterventionCard
                  booking={d.next}
                  perspective="artisan"
                  onPress={() =>
                    router.push({ pathname: '/pro/interventions/[id]', params: { id: d.next!.id } })
                  }
                />
              ) : (
                <Card
                  variant="flat"
                  style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}
                >
                  <Coffee size={24} color={t.colors.text.secondary} />
                  <Text tone="secondary" style={{ flex: 1 }}>
                    Aucune intervention prévue.{' '}
                    {!features.urgent
                      ? 'Les demandes de rendez-vous arrivent ici dès qu’un client réserve un créneau.'
                      : d.urgentAvailable
                        ? 'Les urgences arrivent ici dès qu’un client vous sollicite.'
                        : 'Passez disponible pour recevoir des urgences.'}
                  </Text>
                </Card>
              )}
            </View>

            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader title="Résumé du jour" />
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <Stat icon={CalendarCheck} label="Interventions" value={String(d.today.count)} />
                <Stat icon={Wrench} label="Terminées" value={String(d.today.completed)} />
                <Stat
                  icon={Euro}
                  label="Gains"
                  value={formatEuros(d.today.earningsCents)}
                  onPress={() => router.push('/pro/profil/revenus')}
                />
              </View>
            </View>

            {d.upcoming.filter((b) => b.id !== d.next?.id).length ? (
              <View style={{ gap: t.spacing.sm }}>
                <SectionHeader
                  title="À venir"
                  action={{ label: 'Tout voir', onPress: () => router.push('/pro/interventions') }}
                />
                {d.upcoming
                  .filter((b) => b.id !== d.next?.id)
                  .slice(0, 3)
                  .map((b, i) => (
                    <StaggerItem key={b.id} index={i}>
                      <ArtisanBookingCard booking={b} />
                    </StaggerItem>
                  ))}
              </View>
            ) : null}
          </View>
        )}
      </QueryView>
    </HeroSheetLayout>
  );
}

/** Sous-titre de l'en-tête : « 2 interventions aujourd'hui · 1 demande à traiter ». */
export function daySummary(d: Pick<ArtisanDashboardDto, 'today' | 'pendingRequests'>): string {
  const n = d.today.count;
  const req = d.pendingRequests?.length ?? 0;
  const left = Math.max(0, n - d.today.completed);
  const day =
    n === 0
      ? 'Aucune intervention prévue aujourd’hui'
      : left === 0
        ? `${n} intervention${n > 1 ? 's' : ''} aujourd’hui, toutes terminées`
        : `${n} intervention${n > 1 ? 's' : ''} aujourd’hui${left < n ? `, ${left} restante${left > 1 ? 's' : ''}` : ''}`;
  return req ? `${day} · ${req} demande${req > 1 ? 's' : ''} à traiter.` : `${day}.`;
}

/** Pastille de date (« Samedi 25 octobre »), comme la pastille de l'accueil client. */
function DateChip() {
  const t = useTheme();
  const label = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  })
    .format(new Date())
    .replace(/^./, (c) => c.toUpperCase());
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: t.spacing.xs,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 4,
        borderRadius: t.radius.full,
        backgroundColor: t.colors.background.surface,
        ...t.elevation(1),
      }}
    >
      <Icon icon={CalendarCheck} size={16} color={t.colors.text.brand} />
      <Text variant="caption" weight="semibold">
        {label}
      </Text>
    </View>
  );
}

function Greeting({ firstName }: { firstName?: string | null }) {
  const h = Number(
    new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', timeZone: 'Europe/Paris' }).format(
      new Date(),
    ),
  );
  const hello = h >= 18 ? 'Bonsoir' : 'Bonjour';
  return (
    <Text variant="display" accessibilityRole="header">
      {hello}
      {firstName ? ` ${firstName}` : ''}
    </Text>
  );
}

function AvailabilityToggle({ dashboard: d }: { dashboard: ArtisanDashboardDto }) {
  const t = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const approved = d.status === 'approved';
  const on = d.urgentAvailable && approved;

  const toggle = useMutation({
    mutationFn: async (available: boolean) => {
      const pos = available
        ? await getUserPosition({ ask: true, reason: 'Pour recevoir les urgences proches de vous' })
        : null;
      if (available && pos?.approximate)
        toast.show({
          message:
            'Position approximative : les urgences sont calculées depuis votre point de départ.',
          type: 'info',
        });
      return api.artisan.setUrgentAvailability({
        available,
        ...(pos && !pos.approximate ? { lat: pos.lat, lng: pos.lng } : {}),
      });
    },
    onMutate: async (available) => {
      await qc.cancelQueries({ queryKey: qk.artisan.dashboard });
      const previous = qc.getQueryData<ArtisanDashboardDto>(qk.artisan.dashboard);
      if (previous)
        qc.setQueryData<ArtisanDashboardDto>(qk.artisan.dashboard, {
          ...previous,
          urgentAvailable: available,
        });
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.artisan.dashboard, ctx.previous);
      toast.error(errorMessage(e));
    },
    onSuccess: (p, available) => {
      qc.setQueryData(qk.artisan.profile, p);
      haptic(available ? 'success' : 'light');
      void qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: qk.artisan.offers });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.artisan.dashboard }),
  });

  // Disponible : position rafraîchie régulièrement (si déjà autorisée, sans redemander).
  useEffect(() => {
    if (!on) return;
    const h = setInterval(async () => {
      if ((await getPermissionState('location')) !== 'granted') return;
      const pos = await getUserPosition();
      if (!pos.approximate)
        void api.artisan
          .setUrgentAvailability({ available: true, lat: pos.lat, lng: pos.lng })
          .catch(() => undefined);
    }, POSITION_REFRESH_MS);
    return () => clearInterval(h);
  }, [on]);

  const bg = on ? t.colors.tone.success.solid : t.colors.background.surface;
  const fg = on ? t.colors.tone.success.onSolid : t.colors.text.primary;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !approved, busy: toggle.isPending }}
      accessibilityLabel="Disponible pour urgences"
      accessibilityHint={
        approved
          ? on
            ? 'Désactiver la réception des urgences'
            : 'Activer la réception des urgences et partager votre position'
          : 'Disponible après validation de votre compte'
      }
      disabled={!approved || toggle.isPending}
      onPress={() => toggle.mutate(!on)}
      testID="urgent-toggle"
      style={({ pressed }) => ({
        minHeight: 96,
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        backgroundColor: approved ? bg : t.colors.background.subtle,
        borderWidth: on ? 0 : 1,
        borderColor: t.colors.border.subtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.lg,
        opacity: pressed ? 0.9 : 1,
        ...t.elevation(on ? 3 : 1),
      })}
    >
      {on ? (
        <Zap size={32} color={fg} />
      ) : (
        <ZapOff size={32} color={approved ? t.colors.text.secondary : t.colors.text.disabled} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title2" color={approved ? fg : t.colors.text.secondary}>
          Disponible pour urgences
        </Text>
        <Text variant="callout" color={on ? fg : t.colors.text.secondary}>
          {!approved
            ? 'Débloqué après la validation de votre compte'
            : on
              ? 'Vous recevez les demandes proches. Position partagée.'
              : 'Vous ne recevez pas d’urgences'}
        </Text>
      </View>
      <View
        style={{
          width: 64,
          height: 36,
          borderRadius: 18,
          padding: 3,
          backgroundColor: on ? t.colors.tone.success.onSolid : t.colors.border.input,
          alignItems: on ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
        }}
      >
        {toggle.isPending ? (
          <ActivityIndicator
            color={on ? t.colors.tone.success.solid : t.colors.background.surface}
            style={{ width: 30, height: 30 }}
          />
        ) : (
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: on ? t.colors.tone.success.solid : t.colors.background.surface,
            }}
          />
        )}
      </View>
    </Pressable>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: typeof Euro;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Card
      style={{ flex: 1, gap: t.spacing.xs, alignItems: 'flex-start' }}
      padding="md"
      onPress={onPress}
      accessibilityLabel={`${label} : ${value}`}
    >
      <Icon size={20} color={t.colors.text.brand} />
      <Text variant="title2" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </Card>
  );
}

function HomeSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.xl }}>
      <SkeletonCard />
      <Skeleton height={96} radius={20} />
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Skeleton height={88} style={{ flex: 1 }} width="32%" />
        <Skeleton height={88} width="32%" />
        <Skeleton height={88} width="32%" />
      </View>
    </View>
  );
}
