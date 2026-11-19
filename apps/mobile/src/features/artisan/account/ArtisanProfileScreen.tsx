import {
  DOMAIN_LABELS,
  RULES,
  type ArtisanPrivateProfileDto,
  type ArtisanStatus,
  type FilePurpose,
} from '@depano/schemas';
import {
  Avatar,
  Badge,
  Card,
  Divider,
  formatDateLong,
  formatRating,
  IconButton,
  IconCircle,
  ListItem,
  Screen,
  Skeleton,
  SkeletonList,
  Text,
  useTheme,
  useToast,
  type LucideIcon,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, type Href } from 'expo-router';
import {
  ArrowLeftRight,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Eye,
  ImagePlus,
  LifeBuoy,
  Pencil,
  Rocket,
  Settings,
  ShieldCheck,
  Star,
  Tag,
  Wallet,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { HeaderBell } from '@/components/HeaderBell';
import { QueryView } from '@/components/QueryView';
import { useSwitchRole } from '@/components/RoleSwitch';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { pickImage, uploadFile } from '@/lib/upload';
import { useArtisanProfile, useProfileMutation, useStats } from '../queries';
import { BioSheet } from './PublicPreviewScreen';
import { promotionPriceLabel } from './PromotionScreen';

/** Nombre maximum de photos de réalisations (ArtisanProfileBody.portfolioFileIds). */
export const PORTFOLIO_MAX = 20;

const ACCOUNT_STATUS_LABEL: Record<ArtisanStatus, string> = {
  draft: 'Inscription à compléter',
  pending_review: 'En vérification (48 h ouvrées)',
  approved: 'Profil vérifié, visible des clients',
  rejected: 'Dossier refusé',
  suspended: 'Compte suspendu',
};

interface Row {
  title: string;
  icon: LucideIcon;
  href: Href;
  subtitle?: string;
  testID?: string;
}

/**
 * « Mon profil » artisan (maquette) : bannière et photo modifiables, nom, métiers et ville, note,
 * biographie, « Promouvoir mon compte », photos de réalisations, puis les raccourcis de l'espace pro.
 */
export function ArtisanProfileScreen() {
  const profile = useArtisanProfile();
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mon profil',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <HeaderBell />
              <IconButton
                icon={Settings}
                accessibilityLabel="Paramètres"
                onPress={() => router.push('/parametres')}
                testID="open-settings"
              />
            </View>
          ),
        }}
      />
      <QueryView query={profile} loading={<ProfileSkeleton />}>
        {(p) => <Profile p={p} />}
      </QueryView>
    </>
  );
}

/** Choisit une image, la téléverse, puis enregistre son identifiant. */
function useImageUpload(purpose: FilePurpose, save: (fileId: string) => Promise<unknown>) {
  const toast = useToast();
  return useMutation({
    mutationFn: async () => {
      const file = await pickImage('library').catch(() => null);
      if (!file) return false;
      const up = await uploadFile(file, purpose);
      await save(up.fileId);
      return true;
    },
    onError: (e) => toast.error(errorMessage(e, "L'envoi de l'image a échoué. Réessayez.")),
  });
}

function Profile({ p }: { p: ArtisanPrivateProfileDto }) {
  const t = useTheme();
  const qc = useQueryClient();
  const me = useMe();
  const stats = useStats();
  const switchRole = useSwitchRole();
  const [bioOpen, setBioOpen] = useState(false);
  const update = useProfileMutation(api.artisan.updateProfile);

  const banner = useImageUpload('banner', (bannerFileId) => update.mutateAsync({ bannerFileId }));
  const avatar = useImageUpload('avatar', async (avatarFileId) => {
    const m = await api.me.update({ avatarFileId });
    qc.setQueryData(qk.me, m);
    void qc.invalidateQueries({ queryKey: qk.artisan.profile });
  });

  const avatarUrl = p.avatarUrl ?? me.data?.avatarUrl ?? null;
  const rating = formatRating(stats.data?.ratingAvg);
  const ratingCount = stats.data?.ratingCount ?? 0;
  const subtitle = [p.domains.map((d) => DOMAIN_LABELS[d]).join(', '), p.baseCity]
    .filter(Boolean)
    .join(' - ');

  const MAIN: Row[] = [
    { title: 'Ajouter mes tarifs', icon: Tag, href: '/pro/profil/tarifs', testID: 'row-tarifs' },
    {
      title: 'Mes rendez-vous',
      icon: CalendarCheck,
      href: '/pro/interventions',
      testID: 'row-rdv',
    },
    {
      title: 'Gérer mes disponibilités',
      icon: CalendarClock,
      href: '/pro/profil/disponibilites',
      testID: 'row-dispos',
    },
    {
      title: 'Avis clients',
      subtitle: ratingCount ? `${ratingCount} avis` : undefined,
      icon: Star,
      href: { pathname: '/pro/profil/activite', params: { onglet: 'avis' } },
      testID: 'row-avis',
    },
    {
      title: 'Disponibilité du compte',
      subtitle: ACCOUNT_STATUS_LABEL[p.status],
      icon: ShieldCheck,
      href: '/pro/onboarding',
      testID: 'row-compte',
    },
  ];
  const MORE: Row[] = [
    {
      title: 'Profil public',
      subtitle: 'Aperçu « vu client »',
      icon: Eye,
      href: '/pro/profil/apercu',
    },
    { title: 'Revenus', icon: Wallet, href: '/pro/profil/revenus' },
    { title: 'Statistiques', icon: BarChart3, href: '/pro/profil/statistiques' },
    { title: 'Aide', icon: LifeBuoy, href: '/pro/profil/aide' },
  ];

  return (
    <Screen inTabs padded={false} testID="pro-profile">
      {/* Bannière + photo */}
      <View>
        <View
          style={{ height: 160, backgroundColor: t.colors.brand.surface }}
          accessible={!!p.bannerUrl}
          accessibilityRole={p.bannerUrl ? 'image' : undefined}
          accessibilityLabel={p.bannerUrl ? 'Bannière de votre profil' : undefined}
        >
          {p.bannerUrl ? (
            <Image
              source={{ uri: p.bannerUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : null}
          <View style={{ position: 'absolute', right: t.spacing.sm, bottom: t.spacing.sm }}>
            {banner.isPending ? (
              <ActivityIndicator color={t.colors.text.primary} style={{ width: 48, height: 48 }} />
            ) : (
              <IconButton
                icon={Pencil}
                variant="filled"
                accessibilityLabel={p.bannerUrl ? 'Changer la bannière' : 'Ajouter une bannière'}
                onPress={() => banner.mutate()}
                testID="edit-banner"
              />
            )}
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: t.spacing.lg,
            marginTop: -48,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: t.spacing.md,
          }}
        >
          <View
            style={{
              borderRadius: 52,
              borderWidth: 4,
              borderColor: t.colors.background.canvas,
              backgroundColor: t.colors.background.canvas,
            }}
          >
            <Avatar name={p.displayName} uri={avatarUrl} size={96} decorative={false} />
            <View style={{ position: 'absolute', right: -8, bottom: -8 }}>
              {avatar.isPending ? (
                <ActivityIndicator
                  color={t.colors.text.primary}
                  style={{ width: 48, height: 48 }}
                />
              ) : (
                <IconButton
                  icon={Pencil}
                  variant="filled"
                  accessibilityLabel="Changer la photo de profil"
                  onPress={() => avatar.mutate()}
                  testID="edit-avatar"
                />
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={{ padding: t.spacing.lg, gap: t.spacing.xl }}>
        <View style={{ gap: 2 }}>
          <Text variant="title1" accessibilityRole="header">
            {p.displayName}
          </Text>
          {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
          <Text tone="secondary">
            {rating ? `Noté ${rating}/5 (${ratingCount} avis)` : 'Pas encore d’avis'}
          </Text>
          {p.promotion?.active ? (
            <View style={{ alignSelf: 'flex-start', marginTop: t.spacing.xs }}>
              <Badge label="Mis en avant" tone="success" />
            </View>
          ) : null}
        </View>

        {/* Promouvoir */}
        <Card
          variant="brand"
          onPress={() => router.push('/pro/profil/promotion')}
          accessibilityLabel={`Promouvoir mon compte. ${p.promotion?.active && p.promotion.until ? `Actif jusqu’au ${formatDateLong(p.promotion.until)}` : 'Profitez d’un avantage marketing en promouvant votre profil sur la plateforme'}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}
          testID="promote-card"
        >
          <IconCircle
            icon={Rocket}
            size={48}
            colors={{ bg: t.colors.background.surface, fg: t.colors.text.primary }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Promouvoir mon compte</Text>
            <Text variant="callout" tone="secondary">
              {p.promotion?.active && p.promotion.until
                ? `Actif jusqu’au ${formatDateLong(p.promotion.until)}`
                : `Profitez d’un avantage marketing en promouvant votre profil sur la plateforme. ${promotionPriceLabel(p.promotion ?? RULES.promotion)}.`}
            </Text>
          </View>
        </Card>

        {/* Biographie */}
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="title2" style={{ flex: 1 }}>
              Biographie
            </Text>
            <IconButton
              icon={Pencil}
              accessibilityLabel="Modifier la biographie"
              onPress={() => setBioOpen(true)}
              testID="edit-bio"
            />
          </View>
          <Text tone={p.bio ? 'primary' : 'secondary'}>
            {p.bio ||
              'Présentez-vous : expérience, spécialités, quartiers desservis. Les clients choisissent plus facilement un artisan qui se présente.'}
          </Text>
        </View>

        <Divider />
        <Portfolio p={p} />
        <Divider />

        <Card padding="none">
          {MAIN.map((r, i) => (
            <View key={r.title}>
              {i > 0 ? <Divider inset={56} /> : null}
              <ListItem
                title={r.title}
                subtitle={r.subtitle}
                icon={r.icon}
                onPress={() => router.push(r.href)}
                testID={r.testID}
              />
            </View>
          ))}
        </Card>
        <Card padding="none">
          {MORE.map((r, i) => (
            <View key={r.title}>
              {i > 0 ? <Divider inset={56} /> : null}
              <ListItem
                title={r.title}
                subtitle={r.subtitle}
                icon={r.icon}
                onPress={() => router.push(r.href)}
              />
            </View>
          ))}
        </Card>
        <Card padding="none">
          <ListItem
            title="Passer en mode client"
            subtitle="Réserver un artisan pour vous"
            icon={ArrowLeftRight}
            onPress={() => void switchRole('client')}
            testID="switch-role"
          />
          <Divider inset={56} />
          <ListItem title="Paramètres" icon={Settings} onPress={() => router.push('/parametres')} />
        </Card>
      </View>
      <BioSheet visible={bioOpen} onClose={() => setBioOpen(false)} bio={p.bio ?? ''} />
    </Screen>
  );
}

/** « Ajouter des illustrations » : photos de réalisations (ajout immédiat, retrait), 20 maximum. */
function Portfolio({ p }: { p: ArtisanPrivateProfileDto }) {
  const t = useTheme();
  const toast = useToast();
  const update = useProfileMutation(api.artisan.updateProfile);
  const ids = p.portfolioFileIds ?? [];
  const add = useImageUpload('portfolio', (fileId) =>
    update.mutateAsync({ portfolioFileIds: [...ids, fileId] }),
  );
  const remove = (i: number) =>
    update.mutate(
      { portfolioFileIds: ids.filter((_, j) => j !== i) },
      {
        onSuccess: () => toast.show({ message: 'Photo retirée.', type: 'info' }),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  const full = p.portfolioUrls.length >= PORTFOLIO_MAX;
  const size = 76;

  return (
    <View style={{ gap: t.spacing.md }} testID="portfolio">
      <View style={{ gap: 2 }}>
        <Text variant="title2">Ajouter des illustrations</Text>
        <Text variant="callout" tone="secondary">
          Photos de vos réalisations, visibles sur votre fiche ({p.portfolioUrls.length}/
          {PORTFOLIO_MAX}).
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {p.portfolioUrls.map((u, i) => (
          <View
            key={u}
            style={{
              width: size,
              height: size,
              borderRadius: t.radius.md,
              overflow: 'hidden',
              backgroundColor: t.colors.background.subtle,
            }}
          >
            <Image
              source={{ uri: u }}
              style={{ width: size, height: size }}
              contentFit="cover"
              accessibilityLabel={`Réalisation ${i + 1}`}
            />
            {ids[i] ? (
              <IconButton
                icon={X}
                variant="filled"
                accessibilityLabel={`Retirer la réalisation ${i + 1}`}
                disabled={update.isPending}
                onPress={() => remove(i)}
                style={{ position: 'absolute', top: -6, right: -6 }}
              />
            ) : null}
          </View>
        ))}
        {!full ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une photo de réalisation"
            onPress={() => add.mutate()}
            disabled={add.isPending}
            style={{
              width: size,
              height: size,
              borderRadius: t.radius.md,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: t.colors.border.input,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            testID="portfolio-add"
          >
            {add.isPending ? (
              <ActivityIndicator color={t.colors.text.secondary} />
            ) : (
              <ImagePlus size={28} color={t.colors.text.secondary} />
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ProfileSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.lg }}>
      <Skeleton height={160} radius={0} />
      <View style={{ paddingHorizontal: t.spacing.lg, gap: t.spacing.lg }}>
        <Skeleton width={96} height={96} radius={48} />
        <Skeleton width="60%" height={28} />
        <SkeletonList count={3} variant="row" />
      </View>
    </View>
  );
}
