import { DOMAIN_LABELS, formatEuros, type ArtisanCardDto, type ReviewDto } from '@depano/schemas';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  DomainChip,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonText,
  StarRating,
  Text,
  formatDateLong,
  formatDateTime,
  formatDistance,
  formatRating,
  formatTime,
  relativeDayLabel,
  useTheme,
} from '@depano/ui';
import { router, Stack } from 'expo-router';
import { Award, BadgeCheck, CalendarOff, Heart, MapPin, ShieldCheck, Siren, UserRoundX } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { ApiError, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useArtisan, useArtisanReviews, useFavorites, useSlots, useToggleFavorite } from '../queries';
import { useSearchOrigin } from '../useSearchOrigin';

function ReviewItem({ r }: { r: ReviewDto }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.xs, paddingVertical: t.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text variant="bodyStrong">{r.authorFirstName}</Text>
        <StarRating value={r.rating} />
        <Text variant="caption" tone="secondary" style={{ marginLeft: 'auto' }}>
          {formatDateLong(r.createdAt)}
        </Text>
      </View>
      {r.tags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
          {r.tags.map((tag) => (
            <Badge key={tag} label={tag} tone="neutral" appearance="soft" />
          ))}
        </View>
      ) : null}
      {r.comment ? <Text>{r.comment}</Text> : null}
      {r.photoUrls.length ? (
        <ScrollView horizontal contentContainerStyle={{ gap: t.spacing.sm }}>
          {r.photoUrls.map((u, i) => (
            <Image key={u} source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: t.radius.sm }} accessibilityLabel={`Photo ${i + 1} de l'avis`} />
          ))}
        </ScrollView>
      ) : null}
      {r.reply ? (
        <Card variant="flat" padding="md">
          <Text variant="label">Réponse de l'artisan</Text>
          <Text variant="callout">{r.reply.body}</Text>
        </Card>
      ) : null}
    </View>
  );
}

/** Fiche artisan : identité, badges, tarifs, réalisations, zone, avis, prochaines dispos, favori. */
export function ArtisanProfileScreen({ id }: { id: string }) {
  const t = useTheme();
  const { origin } = useSearchOrigin();
  const q = useArtisan(id, origin.approximate ? null : { lat: origin.lat, lng: origin.lng });
  const slots = useSlots(id, undefined, 14);
  const favorites = useFavorites();
  const toggleFav = useToggleFavorite();
  const requireAuth = useRequireAuth();
  const [allReviews, setAllReviews] = useState(false);
  const reviews = useArtisanReviews(allReviews ? id : undefined);
  const a = q.data;
  const isFav = !!favorites.data?.some((f) => f.id === id);

  const onFav = () => {
    if (!a || !requireAuth('Connectez-vous pour enregistrer vos artisans favoris.')) return;
    const card: ArtisanCardDto = { ...a };
    toggleFav.mutate({ artisan: card, favorite: !isFav });
  };

  const header = (
    <Stack.Screen
      options={{
        title: a?.displayName ?? '',
        headerRight: () => (
          <IconButton
            icon={Heart}
            accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            color={isFav ? t.colors.tone.urgent.text : undefined}
            onPress={onFav}
            testID="toggle-favorite"
          />
        ),
      }}
    />
  );

  if (!a) {
    return (
      <Screen>
        {header}
        {q.isError ? (
          q.error instanceof ApiError && q.error.status === 404 ? (
            <EmptyState fill icon={UserRoundX} title="Artisan introuvable" message="Ce profil n'est plus disponible." action={{ label: 'Voir d’autres artisans', onPress: () => router.replace('/recherche') }} />
          ) : (
            <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
          )
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: t.spacing.lg, alignItems: 'center' }}>
              <Skeleton width={96} height={96} radius={48} />
              <View style={{ flex: 1, gap: t.spacing.sm }}>
                <Skeleton width="70%" height={24} />
                <Skeleton width="50%" />
              </View>
            </View>
            <SkeletonText lines={4} />
            <Skeleton height={160} radius={t.radius.md} />
          </View>
        )}
      </Screen>
    );
  }

  const upcoming = (slots.data ?? []).flatMap((d) => d.slots).filter((s) => new Date(s).getTime() > Date.now()).slice(0, 6);
  const unavailable = slots.data !== undefined && upcoming.length === 0;
  const outOfArea = a.distanceKm != null && a.distanceKm > a.radiusKm;
  const reviewList = allReviews ? reviews.data?.pages.flatMap((p) => p.items) ?? [] : a.recentReviews;

  return (
    <Screen
      footer={
        unavailable ? (
          <View style={{ gap: t.spacing.sm }}>
            <Button size="lg" fullWidth variant="secondary" label="Voir d'autres artisans" onPress={() => router.push({ pathname: '/recherche', params: { domain: a.domains[0] } })} />
          </View>
        ) : (
          <Button size="lg" fullWidth label="Prendre rendez-vous" onPress={() => router.push({ pathname: '/rdv/type', params: { artisanId: a.id } })} testID="book-artisan" />
        )
      }
    >
      {header}
      <View style={{ gap: t.spacing.xl }} testID="artisan-profile">
        <View style={{ flexDirection: 'row', gap: t.spacing.lg, alignItems: 'center' }}>
          <Avatar name={a.displayName} uri={a.avatarUrl} size={96} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title1">{a.displayName}</Text>
            <Text tone="secondary">{a.companyName}</Text>
            <StarRating value={a.ratingAvg} count={a.ratingCount} size={18} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {a.domains.map((d) => (
            <DomainChip key={d} domain={d} />
          ))}
          {a.urgentAvailable ? <Chip tone="urgent" icon={Siren} label="Dispo urgence" /> : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {a.badges.siretVerified ? <Chip tone="success" icon={BadgeCheck} label="SIRET vérifié" /> : null}
          {a.badges.insured ? <Chip tone="success" icon={ShieldCheck} label="Assuré" /> : null}
          {a.badges.qualifications.map((qf) => (
            <Chip key={qf} tone="info" icon={Award} label={qf} />
          ))}
        </View>

        {unavailable ? (
          <Card variant="outline" style={{ flexDirection: 'row', gap: t.spacing.md }} testID="artisan-unavailable">
            <Icon icon={CalendarOff} color={t.colors.tone.warning.text} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Indisponible pour le moment</Text>
              <Text variant="callout" tone="secondary">
                Aucun créneau libre dans les 14 prochains jours. Ajoutez-le à vos favoris pour le retrouver plus tard.
              </Text>
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          {[
            { k: 'Interventions', v: String(a.completedCount) },
            { k: 'Acceptation', v: a.acceptanceRate != null ? `${Math.round(a.acceptanceRate * 100)} %` : '—' },
            { k: 'Note', v: formatRating(a.ratingAvg) ?? 'Nouveau' },
          ].map((s) => (
            <Card key={s.k} variant="flat" padding="md" style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={`${s.k} : ${s.v}`}>
              <Text variant="title2">{s.v}</Text>
              <Text variant="caption" tone="secondary">
                {s.k}
              </Text>
            </Card>
          ))}
        </View>

        {a.bio ? <Text>{a.bio}</Text> : null}

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Prochaines disponibilités" />
          {slots.data ? (
            upcoming.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {upcoming.map((s) => (
                  <Chip key={s} label={`${relativeDayLabel(s)} · ${formatTime(s)}`} accessibilityLabel={`Créneau ${formatDateTime(s)}`} onPress={() => router.push({ pathname: '/rdv/type', params: { artisanId: a.id } })} />
                ))}
              </View>
            ) : (
              <Text tone="secondary">Aucun créneau dans les 14 prochains jours.</Text>
            )
          ) : slots.isError ? (
            <Text tone="secondary">Disponibilités indisponibles hors ligne.</Text>
          ) : (
            <Skeleton height={48} />
          )}
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Tarifs" />
          <Card padding="none">
            {a.services.map((s, i) => (
              <View key={s.serviceId}>
                {i > 0 ? <Divider inset={16} /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: t.spacing.lg, gap: t.spacing.md, minHeight: 56 }}>
                  <View style={{ flex: 1 }}>
                    <Text>{s.name}</Text>
                    <Text variant="caption" tone="secondary">
                      {DOMAIN_LABELS[s.domain]} · env. {s.durationMinutes} min
                    </Text>
                  </View>
                  <Text variant="bodyStrong">{formatEuros(s.priceCents)}</Text>
                </View>
              </View>
            ))}
            <Divider />
            <View style={{ padding: t.spacing.lg }}>
              <Text variant="callout" tone="secondary">
                Déplacement : {formatEuros(a.travelFeeCents)}. Prix TTC indicatifs ; devis détaillé obligatoire avant travaux.
              </Text>
            </View>
          </Card>
        </View>

        {a.portfolioUrls.length ? (
          <View style={{ gap: t.spacing.sm }}>
            <SectionHeader title="Réalisations" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.spacing.sm }}>
              {a.portfolioUrls.map((u, i) => (
                <Image key={u} source={{ uri: u }} style={{ width: 160, height: 120, borderRadius: t.radius.md }} accessibilityLabel={`Réalisation ${i + 1}`} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Zone d'intervention" />
          <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <Icon icon={MapPin} color={t.colors.text.brand} />
            <View style={{ flex: 1 }}>
              <Text>
                {a.city ?? 'Marseille'} · rayon de {a.radiusKm} km
              </Text>
              {a.distanceKm != null ? (
                <Text variant="callout" tone={outOfArea ? 'warning' : 'secondary'}>
                  {outOfArea ? `Hors zone : à ${formatDistance(a.distanceKm)} de chez vous` : `À ${formatDistance(a.distanceKm)} de chez vous`}
                </Text>
              ) : null}
              <Text variant="caption" tone="secondary">
                Membre depuis {formatDateLong(a.memberSince).replace(/^\S+ /, '')}
              </Text>
            </View>
          </Card>
        </View>

        <View style={{ gap: t.spacing.xs }}>
          <SectionHeader title={`Avis (${a.ratingCount})`} />
          {reviewList.length ? (
            <Card padding="md">
              {reviewList.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider /> : null}
                  <ReviewItem r={r} />
                </View>
              ))}
            </Card>
          ) : (
            <Text tone="secondary">{allReviews && reviews.isPending ? 'Chargement des avis…' : a.ratingCount ? `Note moyenne ${formatRating(a.ratingAvg)} sur 5.` : 'Pas encore d’avis : soyez le premier à noter cet artisan.'}</Text>
          )}
          {!allReviews && a.ratingCount > a.recentReviews.length ? (
            <Button variant="ghost" label="Voir tous les avis" onPress={() => setAllReviews(true)} />
          ) : null}
          {allReviews && reviews.hasNextPage ? (
            <Button variant="ghost" label="Plus d'avis" loading={reviews.isFetchingNextPage} onPress={() => void reviews.fetchNextPage()} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
