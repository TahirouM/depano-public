import { formatEuros, type ArtisanDashboardDto } from '@depano/schemas';
import {
  Card,
  haptic,
  InterventionCard,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonCard,
  Text,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarCheck, Coffee, Euro, Wrench, Zap, ZapOff } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { getPermissionState, getUserPosition } from '@/lib/permissions';
import { useMe } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { AccountStatusCard } from '../components/AccountStatusCard';
import { OfferCard } from '../components/OfferCard';
import { useArtisanProfile, useDashboard } from '../queries';

/** Rafraîchit la position envoyée au dispatch tant que l'artisan est disponible. */
const POSITION_REFRESH_MS = 5 * 60_000;

/**
 * Accueil artisan : interrupteur « Disponible pour urgences » (envoie la position),
 * demandes en attente, prochaine intervention, résumé du jour. État « compte non validé ».
 */
export function HomeScreen() {
  const t = useTheme();
  const dash = useDashboard();
  const me = useMe();
  const profile = useArtisanProfile({
    enabled: !!me.data?.artisan && me.data.artisan.status !== 'approved',
  });

  return (
    <Screen
      inTabs
      refreshing={dash.isRefetching}
      onRefresh={() => void dash.refetch()}
      testID="pro-home"
    >
      <QueryView query={dash} loading={<HomeSkeleton />}>
        {(d) => (
          <View style={{ gap: t.spacing.xl }}>
            <Greeting firstName={me.data?.firstName} />
            {d.status !== 'approved' ? (
              <AccountStatusCard status={d.status} reason={profile.data?.rejectionReason} />
            ) : null}
            <AvailabilityToggle dashboard={d} />

            {d.pendingOffers.length ? (
              <View style={{ gap: t.spacing.sm }}>
                <SectionHeader title={`Demandes en attente (${d.pendingOffers.length})`} />
                {d.pendingOffers.map((o) => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    onPress={() =>
                      router.push({ pathname: '/pro/offre/[id]', params: { id: o.id } })
                    }
                  />
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
                    {d.urgentAvailable
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
                  .map((b) => (
                    <InterventionCard
                      key={b.id}
                      booking={b}
                      perspective="artisan"
                      onPress={() =>
                        router.push({ pathname: '/pro/interventions/[id]', params: { id: b.id } })
                      }
                    />
                  ))}
              </View>
            ) : null}
          </View>
        )}
      </QueryView>
    </Screen>
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
    <Text variant="title1" accessibilityRole="header">
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
      <Skeleton width="50%" height={28} />
      <Skeleton height={96} radius={20} />
      <SkeletonCard />
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Skeleton height={88} style={{ flex: 1 }} width="32%" />
        <Skeleton height={88} width="32%" />
        <Skeleton height={88} width="32%" />
      </View>
    </View>
  );
}
