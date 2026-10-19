import { Avatar, Card, ErrorState, Skeleton, StarRating, Text, useTheme } from '@depano/ui';
import type { ArtisanPublicDto } from '@depano/schemas';
import type { UseQueryResult } from '@tanstack/react-query';
import { View } from 'react-native';
import { errorMessage } from '@/lib/api';

/** Rappel compact de l'artisan en haut de chaque étape du RDV (ou squelette / erreur). */
export function RdvArtisanBanner({ artisan }: { artisan: UseQueryResult<ArtisanPublicDto> }) {
  const t = useTheme();
  if (artisan.data) {
    const a = artisan.data;
    return (
      <Card variant="flat" padding="md" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Avatar name={a.displayName} uri={a.avatarUrl} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Avec {a.displayName}</Text>
          <Text variant="callout" tone="secondary">
            {a.companyName}
          </Text>
        </View>
        {a.ratingAvg != null ? <StarRating value={a.ratingAvg} count={a.ratingCount} /> : null}
      </Card>
    );
  }
  if (artisan.isError) return <ErrorState fill={false} message={errorMessage(artisan.error)} onRetry={() => void artisan.refetch()} />;
  return <Skeleton height={64} radius={t.radius.md} />;
}
