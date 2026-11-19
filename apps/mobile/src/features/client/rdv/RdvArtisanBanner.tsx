import { Avatar, Card, DomainChip, ErrorState, Skeleton, StarRating, Text, useTheme } from '@depano/ui';
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
      <Card padding="md" style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
        <Avatar name={a.displayName} uri={a.avatarUrl} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" weight="bold" numberOfLines={1}>
            {a.displayName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {a.companyName}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs, marginTop: 2 }}>
            {a.domains.map((d) => (
              <DomainChip key={d} domain={d} size="sm" />
            ))}
          </View>
        </View>
        {a.ratingAvg != null ? <StarRating value={a.ratingAvg} count={a.ratingCount} size={14} /> : null}
      </Card>
    );
  }
  if (artisan.isError) return <ErrorState fill={false} message={errorMessage(artisan.error)} onRetry={() => void artisan.refetch()} />;
  return <Skeleton height={80} radius={t.radius.md} />;
}
