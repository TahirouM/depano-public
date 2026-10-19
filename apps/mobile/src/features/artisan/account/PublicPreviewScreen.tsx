import {
  DOMAIN_LABELS,
  type ArtisanCardDto,
  type ArtisanPrivateProfileDto,
  type ReviewDto,
} from '@depano/schemas';
import {
  AccentScope,
  ArtisanCard,
  BottomSheet,
  Button,
  Card,
  Divider,
  formatDateLong,
  PriceRow,
  Screen,
  SectionHeader,
  SkeletonList,
  StarRating,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { Eye, MapPin, Pencil } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { useArtisanProfile, useArtisanReviews, useStats } from '../queries';

/** Carte artisan telle que la voient les clients, reconstruite depuis le profil privé. */
function toCard(
  p: ArtisanPrivateProfileDto,
  avatarUrl: string | null,
  rating: { avg: number | null; count: number },
): ArtisanCardDto {
  return {
    id: p.id,
    displayName: p.displayName,
    companyName: p.companyName ?? '',
    avatarUrl,
    domains: p.domains,
    ratingAvg: rating.avg,
    ratingCount: rating.count,
    distanceKm: null,
    approxLat: p.baseLat != null ? Math.round(p.baseLat * 100) / 100 : null,
    approxLng: p.baseLng != null ? Math.round(p.baseLng * 100) / 100 : null,
    fromPriceCents: p.services.length ? Math.min(...p.services.map((s) => s.priceCents)) : null,
    urgentAvailable: p.urgentAvailable,
    nextSlotAt: null,
    badges: {
      siretVerified: p.checklist.siret,
      insured: p.checklist.insurance,
      qualifications: p.qualifications,
    },
  };
}

/** Profil public : aperçu « vu client » (accent client), tarifs, zone, réalisations, avis. */
export function PublicPreviewScreen() {
  const profile = useArtisanProfile();
  return (
    <>
      <Stack.Screen options={{ title: 'Profil public' }} />
      <QueryView query={profile} loading={<SkeletonList count={4} />}>
        {(p) => <Preview p={p} />}
      </QueryView>
    </>
  );
}

function Preview({ p }: { p: ArtisanPrivateProfileDto }) {
  const t = useTheme();
  const me = useMe();
  const stats = useStats();
  const reviews = useArtisanReviews();
  const [editing, setEditing] = useState(false);
  const card = toCard(p, me.data?.avatarUrl ?? null, {
    avg: stats.data?.ratingAvg ?? null,
    count: stats.data?.ratingCount ?? 0,
  });
  const list: ReviewDto[] = reviews.data?.pages.flatMap((pg) => pg.items) ?? [];

  return (
    <Screen inTabs testID="public-preview">
      <View style={{ gap: t.spacing.lg }}>
        <Card
          variant="flat"
          style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}
        >
          <Eye size={20} color={t.colors.text.secondary} />
          <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
            Aperçu tel que les clients voient votre fiche
            {p.status !== 'approved' ? ' (visible après validation)' : ''}.
          </Text>
        </Card>
        <AccentScope accent="client">
          <View style={{ gap: t.spacing.lg }}>
            <ArtisanCard artisan={card} />
            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader
                title="Présentation"
                action={{ label: 'Modifier', onPress: () => setEditing(true) }}
              />
              <Text tone={p.bio ? 'primary' : 'secondary'}>
                {p.bio ||
                  'Ajoutez quelques lignes : expérience, spécialités, quartiers desservis. Les clients choisissent plus facilement un artisan qui se présente.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: t.spacing.xs, alignItems: 'center' }}>
                <MapPin size={16} color={t.colors.text.secondary} />
                <Text variant="callout" tone="secondary">
                  {p.baseCity ?? 'Marseille'} · intervient dans un rayon de {p.radiusKm} km
                </Text>
              </View>
            </View>

            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader title="Tarifs" />
              <Card style={{ gap: t.spacing.sm }}>
                {p.services.length ? (
                  p.services.map((s) => (
                    <PriceRow
                      key={s.serviceId}
                      label={s.name}
                      cents={s.priceCents}
                      hint={DOMAIN_LABELS[s.domain]}
                    />
                  ))
                ) : (
                  <Text tone="secondary">Aucune prestation publiée.</Text>
                )}
                <Divider />
                <PriceRow label="Déplacement" cents={p.travelFeeCents} />
              </Card>
              <Text variant="caption" tone="secondary">
                Prix TTC. Devis détaillé obligatoire avant travaux.
              </Text>
            </View>

            {p.portfolioUrls.length ? (
              <View style={{ gap: t.spacing.sm }}>
                <SectionHeader title="Réalisations" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {p.portfolioUrls.map((u, i) => (
                    <Image
                      key={u}
                      source={{ uri: u }}
                      style={{ width: 104, height: 104, borderRadius: t.radius.md }}
                      accessibilityLabel={`Réalisation ${i + 1}`}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: t.spacing.sm }}>
              <SectionHeader title={`Avis (${stats.data?.ratingCount ?? list.length})`} />
              {list.length ? (
                list.slice(0, 5).map((r) => <ReviewCard key={r.id} r={r} />)
              ) : (
                <Text tone="secondary">Pas encore d'avis publiés.</Text>
              )}
            </View>
          </View>
        </AccentScope>
      </View>
      <BioSheet visible={editing} onClose={() => setEditing(false)} bio={p.bio ?? ''} />
    </Screen>
  );
}

export function ReviewCard({ r, footer }: { r: ReviewDto; footer?: ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ gap: t.spacing.sm }} testID={`review-${r.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="bodyStrong">{r.authorFirstName}</Text>
        <StarRating value={r.rating} />
      </View>
      <Text variant="caption" tone="secondary">
        {formatDateLong(r.createdAt)}
        {r.tags.length ? ` · ${r.tags.join(', ')}` : ''}
      </Text>
      {r.comment ? <Text>{r.comment}</Text> : null}
      {r.reply ? (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: t.colors.brand.primary,
            paddingLeft: t.spacing.md,
            gap: 2,
          }}
        >
          <Text variant="label">Votre réponse</Text>
          <Text variant="callout">{r.reply.body}</Text>
        </View>
      ) : null}
      {footer}
    </Card>
  );
}

function BioSheet({
  visible,
  onClose,
  bio,
}: {
  visible: boolean;
  onClose: () => void;
  bio: string;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState(bio);
  const save = useMutation({
    mutationFn: () => api.artisan.updateProfile({ bio: text.trim() || null }),
    onSuccess: (p) => {
      qc.setQueryData(qk.artisan.profile, p);
      toast.success('Présentation mise à jour.');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Votre présentation"
      footer={
        <Button
          label="Enregistrer"
          icon={Pencil}
          size="lg"
          fullWidth
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      }
    >
      <TextField
        label="Présentation"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        helper={`${text.length} / 2000 caractères`}
      />
      <Text variant="caption" tone="secondary">
        Ne mentionnez pas votre numéro : les échanges passent par DEPANO.
      </Text>
    </BottomSheet>
  );
}
