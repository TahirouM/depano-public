import type { BookingDetailDto } from '@depano/schemas';
import { Avatar, Button, Card, Chip, EmptyState, ErrorState, IconButton, Screen, Skeleton, StarRating, Text, TextField, formatDateLong, haptic, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { CalendarX, Image as ImageIcon, MessageSquareHeart, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { api, errorMessage } from '@/lib/api';
import { useBooking } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';
import { pickImage, uploadFile, type LocalFile } from '@/lib/upload';

const POSITIVE = ['Ponctuel', 'Travail soigné', 'Prix respecté', 'Bons conseils', 'Propre', 'Sympathique'];
const NEGATIVE = ['En retard', 'Travail à reprendre', 'Peu clair sur le prix', 'Peu soigneux'];
const RATING_LABEL = ['', 'Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];

/**
 * Notation : étoiles, tags, commentaire, photo ; état « déjà noté » et fenêtre de 14 jours.
 * `backHref` : écran de l'intervention à retrouver (onglet Rendez-vous par défaut, ou Interventions).
 */
export function ReviewScreen({ id, backHref }: { id: string; backHref?: Href }) {
  return (
    <AuthGate title="Notation" message="Connectez-vous pour noter votre artisan.">
      <ReviewInner id={id} backHref={backHref ?? { pathname: '/activite/[id]', params: { id } }} />
    </AuthGate>
  );
}

function ReviewInner({ id, backHref }: { id: string; backHref: Href }) {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useBooking(id);
  const b = q.data;
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<LocalFile[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      const photoFileIds: string[] = [];
      for (const p of photos) photoFileIds.push((await uploadFile(p, 'review')).fileId);
      return api.bookings.review(id, { rating, tags, comment: comment.trim() || undefined, photoFileIds });
    },
    onSuccess: (review) => {
      // Vibration de succès seulement une fois l'avis enregistré par le serveur.
      haptic('success');
      qc.setQueryData<BookingDetailDto>(qk.bookings.detail(id), (old) => (old ? { ...old, review, canReview: false } : old));
      void qc.invalidateQueries({ queryKey: qk.bookings.detail(id) });
      if (b?.artisan) void qc.invalidateQueries({ queryKey: qk.catalog.artisan(b.artisan.id) });
      toast.success('Merci pour votre avis !');
      router.dismissTo(backHref);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const header = <Stack.Screen options={{ title: 'Noter l’intervention' }} />;
  if (!b) {
    return (
      <Screen inTabs>
        {header}
        {q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : <Skeleton height={240} radius={t.radius.md} />}
      </Screen>
    );
  }

  if (b.review) {
    const r = b.review;
    return (
      <Screen inTabs footer={<Button size="lg" fullWidth label="Retour" onPress={() => router.dismissTo(backHref)} />}>
        {header}
        <View style={{ gap: t.spacing.lg }} testID="already-reviewed">
          <EmptyState icon={MessageSquareHeart} title="Vous avez déjà noté cette intervention" message={`Avis publié le ${formatDateLong(r.createdAt)}.`} />
          <Card style={{ gap: t.spacing.sm }}>
            <StarRating value={r.rating} size={20} />
            {r.tags.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                {r.tags.map((x) => (
                  <Chip key={x} size="sm" label={x} />
                ))}
              </View>
            ) : null}
            {r.comment ? <Text>{r.comment}</Text> : null}
            {r.reply ? (
              <Card variant="flat" padding="md">
                <Text variant="label">Réponse de l'artisan</Text>
                <Text variant="callout">{r.reply.body}</Text>
              </Card>
            ) : null}
          </Card>
        </View>
      </Screen>
    );
  }

  if (!b.canReview) {
    return (
      <Screen inTabs>
        {header}
        <EmptyState
          fill
          icon={CalendarX}
          title={b.status === 'closed' ? 'La notation est fermée' : 'Pas encore'}
          message={b.status === 'closed' ? 'Les avis sont ouverts pendant 14 jours après la fin de l’intervention.' : 'Vous pourrez noter l’artisan une fois l’intervention terminée.'}
          action={{ label: "Retour à l'intervention", onPress: () => router.dismissTo(backHref) }}
        />
      </Screen>
    );
  }

  const tagList = rating > 0 && rating <= 3 ? NEGATIVE : POSITIVE;
  return (
    <Screen
      inTabs
      footer={
        <Button size="lg" fullWidth label="Publier mon avis" disabled={!rating} loading={submit.isPending} onPress={() => submit.mutate()} testID="submit-review" />
      }
    >
      {header}
      <View style={{ gap: t.spacing.xl }} testID="review-form">
        {b.artisan ? (
          <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
            <Avatar name={b.artisan.displayName} uri={b.artisan.avatarUrl} size={64} />
            <Text variant="title2" align="center">
              Comment s'est passée l'intervention avec {b.artisan.displayName} ?
            </Text>
          </View>
        ) : null}
        <View style={{ alignItems: 'center', gap: t.spacing.xs }}>
          <StarRating value={rating} onChange={(v) => setRating(v)} />
          <Text tone="secondary" accessibilityLiveRegion="polite">
            {rating ? RATING_LABEL[rating] : 'Touchez une étoile'}
          </Text>
        </View>
        {rating ? (
          <View style={{ gap: t.spacing.sm }}>
            <Text variant="label">{rating <= 3 ? 'Qu’est-ce qui n’a pas été ?' : 'Ce que vous avez apprécié'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {tagList.map((x) => (
                <Chip key={x} label={x} selected={tags.includes(x)} onPress={() => setTags((s) => (s.includes(x) ? s.filter((y) => y !== x) : s.length < 8 ? [...s, x] : s))} />
              ))}
            </View>
          </View>
        ) : null}
        <TextField label="Commentaire (facultatif)" value={comment} onChangeText={setComment} multiline maxLength={2000} placeholder="Votre avis aide les autres clients." />
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label">Photo du résultat (facultatif)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, alignItems: 'center' }}>
            {photos.map((p, i) => (
              <View key={p.uri}>
                <Image source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: t.radius.sm }} accessibilityLabel={`Photo ${i + 1}`} />
                <View style={{ position: 'absolute', top: -12, right: -12 }}>
                  <IconButton icon={X} variant="filled" accessibilityLabel={`Retirer la photo ${i + 1}`} onPress={() => setPhotos((s) => s.filter((_, j) => j !== i))} />
                </View>
              </View>
            ))}
            {photos.length < 4 ? (
              <Button
                variant="secondary"
                icon={ImageIcon}
                label="Ajouter"
                onPress={async () => {
                  const f = await pickImage('library');
                  if (f) setPhotos((s) => [...s, f]);
                }}
              />
            ) : null}
          </View>
        </View>
        <Text variant="caption" tone="secondary">
          Votre prénom et votre avis seront publics. L'artisan pourra y répondre.
        </Text>
      </View>
    </Screen>
  );
}
