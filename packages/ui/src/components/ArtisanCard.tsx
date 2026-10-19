import { formatEuros, type ArtisanCardDto } from '@depano/schemas';
import { Pressable, StyleSheet, View } from 'react-native';
import { BadgeCheck, Heart, ShieldCheck, Siren } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { formatDateTime, formatDistance } from '../utils/format';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Chip } from './Chip';
import { DomainChip } from './DomainChip';
import { Icon } from './Icon';
import { StarRating } from './StarRating';
import { Text } from './Text';

export interface ArtisanCardProps {
  artisan: ArtisanCardDto;
  onPress?: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** compact : ligne horizontale pour les carrousels de l'accueil. */
  layout?: 'full' | 'compact';
}

export function ArtisanCard({ artisan: a, onPress, favorite, onToggleFavorite, layout = 'full' }: ArtisanCardProps) {
  const t = useTheme();
  const distance = formatDistance(a.distanceKm);
  const a11y = [
    a.displayName,
    a.companyName,
    a.ratingAvg != null ? `note ${a.ratingAvg.toFixed(1)} sur 5, ${a.ratingCount} avis` : 'nouvel artisan',
    distance ? `à ${distance}` : null,
    a.fromPriceCents != null ? `à partir de ${formatEuros(a.fromPriceCents)}` : null,
    a.urgentAvailable ? 'disponible pour les urgences' : null,
    a.badges.siretVerified ? 'SIRET vérifié' : null,
    a.badges.insured ? 'assuré' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Card variant="brand" onPress={onPress} accessibilityLabel={a11y} style={layout === 'compact' ? { width: 280 } : undefined}>
      <View style={[styles.row, { gap: t.spacing.md }]}>
        <Avatar name={a.displayName} uri={a.avatarUrl} size={layout === 'compact' ? 48 : 64} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {a.displayName}
          </Text>
          <Text variant="callout" tone="secondary" numberOfLines={1}>
            {a.companyName}
          </Text>
          <View style={[styles.row, { gap: t.spacing.sm, marginTop: 2 }]}>
            <StarRating value={a.ratingAvg} count={a.ratingCount} />
            {distance ? (
              <Text variant="callout" tone="secondary">
                · {distance}
              </Text>
            ) : null}
          </View>
        </View>
        {onToggleFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            accessibilityState={{ selected: !!favorite }}
            onPress={onToggleFavorite}
            style={styles.fav}
          >
            <Heart size={22} color={t.colors.tone.urgent.text} fill={favorite ? t.colors.tone.urgent.text : 'transparent'} />
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.wrap, { gap: t.spacing.xs, marginTop: t.spacing.md }]}>
        {a.domains.map((d) => (
          <DomainChip key={d} domain={d} size="sm" />
        ))}
        {a.urgentAvailable ? <Chip size="sm" tone="urgent" icon={Siren} label="Dispo urgence" /> : null}
      </View>
      {layout === 'full' ? (
        <View style={[styles.wrap, { gap: t.spacing.md, marginTop: t.spacing.sm }]}>
          {a.badges.siretVerified ? <Trust icon="siret" /> : null}
          {a.badges.insured ? <Trust icon="insured" /> : null}
          {a.badges.qualifications.map((q) => (
            <Chip key={q} size="sm" tone="success" label={q} />
          ))}
        </View>
      ) : null}
      <View style={[styles.row, styles.between, { marginTop: t.spacing.md, gap: t.spacing.sm }]}>
        {a.fromPriceCents != null ? (
          <Text variant="label">À partir de {formatEuros(a.fromPriceCents)}</Text>
        ) : (
          <View />
        )}
        {a.nextSlotAt ? (
          <Text variant="callout" tone="brand" numberOfLines={1} style={styles.shrink}>
            Dispo {formatDateTime(a.nextSlotAt)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Trust({ icon }: { icon: 'siret' | 'insured' }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { gap: 4 }]}>
      <Icon icon={icon === 'siret' ? BadgeCheck : ShieldCheck} size={16} color={t.colors.tone.success.text} />
      <Text variant="caption" tone="success" weight="semibold">
        {icon === 'siret' ? 'SIRET vérifié' : 'Assuré'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  fav: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
