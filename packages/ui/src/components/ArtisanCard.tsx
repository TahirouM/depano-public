import { formatEuros, type ArtisanCardDto } from '@depano/schemas';
import { StyleSheet, View } from 'react-native';
import { BadgeCheck, ChevronRight, MapPin, ShieldCheck, Siren } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH } from '../tokens/scale';
import { formatDateTime, formatDistance } from '../utils/format';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Chip } from './Chip';
import { DomainChip } from './DomainChip';
import { HeartButton } from './HeartButton';
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
  /**
   * Affiche la disponibilité urgence (pastille sur l'avatar, puce « Dispo urgence », lecteur d'écran).
   * Désactivé par défaut : les urgences sont masquées tant que l'app ne les active pas.
   */
  showUrgent?: boolean;
}

export function ArtisanCard({ artisan: a, onPress, favorite, onToggleFavorite, layout = 'full', showUrgent = false }: ArtisanCardProps) {
  const t = useTheme();
  const urgent = showUrgent && a.urgentAvailable;
  const distance = formatDistance(a.distanceKm);
  const a11y = [
    a.displayName,
    a.companyName,
    a.ratingAvg != null ? `note ${a.ratingAvg.toFixed(1)} sur 5, ${a.ratingCount} avis` : 'nouvel artisan',
    distance ? `à ${distance}` : null,
    a.fromPriceCents != null ? `à partir de ${formatEuros(a.fromPriceCents)}` : null,
    urgent ? 'disponible pour les urgences' : null,
    a.badges.siretVerified ? 'SIRET vérifié' : null,
    a.badges.insured ? 'assuré' : null,
  ]
    .filter(Boolean)
    .join(', ');

  // Le cœur est un bouton frère posé par-dessus la carte (jamais imbriqué dans la carte cliquable :
  // un bouton dans un bouton est invalide sur le web et brouille les lecteurs d'écran).
  return (
    <View style={layout === 'compact' ? { width: 280 } : undefined}>
    <Card onPress={onPress} accessibilityLabel={a11y}>
      <View style={[styles.row, styles.top, { gap: t.spacing.md }]}>
        <View>
          <Avatar name={a.displayName} uri={a.avatarUrl} size={layout === 'compact' ? 48 : 64} />
          {urgent ? (
            <View style={[styles.dot, { backgroundColor: t.colors.tone.success.solid, borderColor: t.colors.background.surface }]} />
          ) : null}
        </View>
        <View style={styles.flex}>
          <View style={[styles.row, { gap: t.spacing.sm }]}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {a.displayName}
            </Text>
            <StarRating value={a.ratingAvg} count={a.ratingCount} size={14} />
          </View>
          <View style={[styles.row, { gap: 4 }]}>
            <Icon icon={MapPin} size={14} color={t.colors.text.secondary} />
            <Text variant="callout" tone="secondary" numberOfLines={1} style={styles.shrink}>
              {[a.companyName, distance].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[styles.wrap, { gap: t.spacing.xs, marginTop: t.spacing.xs }]}>
            {a.domains.map((d) => (
              <DomainChip key={d} domain={d} size="sm" />
            ))}
            {urgent ? <Chip size="sm" tone="urgent" icon={Siren} label="Dispo urgence" /> : null}
          </View>
        </View>
        {/* Réserve la place du cœur superposé, sinon chevron. */}
        {onToggleFavorite ? <View style={styles.fav} /> : onPress ? <Icon icon={ChevronRight} size={20} color={t.colors.text.secondary} /> : null}
      </View>
      {layout === 'full' && (a.badges.siretVerified || a.badges.insured || a.badges.qualifications.length) ? (
        <View style={[styles.wrap, { gap: t.spacing.md, marginTop: t.spacing.md }]}>
          {a.badges.siretVerified ? <Trust icon="siret" /> : null}
          {a.badges.insured ? <Trust icon="insured" /> : null}
          {a.badges.qualifications.map((q) => (
            <Chip key={q} size="sm" tone="success" label={q} />
          ))}
        </View>
      ) : null}
      {a.fromPriceCents != null || a.nextSlotAt ? (
        <View style={[styles.row, styles.between, { marginTop: t.spacing.md, paddingTop: t.spacing.md, gap: t.spacing.sm, borderTopWidth: 1, borderTopColor: t.colors.border.subtle }]}>
          {a.fromPriceCents != null ? <Text variant="label">À partir de {formatEuros(a.fromPriceCents)}</Text> : <View />}
          {a.nextSlotAt ? (
            <Text variant="callout" tone="brand" numberOfLines={1} style={styles.shrink}>
              Dispo {formatDateTime(a.nextSlotAt)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
    {onToggleFavorite ? (
      <View style={[styles.fav, styles.favOverlay, { top: t.spacing.xxl, right: t.spacing.xs }]}>
        <HeartButton
          active={!!favorite}
          onPress={onToggleFavorite}
          accessibilityLabel={favorite ? `Retirer ${a.displayName} des favoris` : `Ajouter ${a.displayName} aux favoris`}
          testID={`fav-${a.id}`}
        />
      </View>
    ) : null}
    </View>
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
  top: { alignItems: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  flex: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  dot: { position: 'absolute', right: 2, bottom: 2, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  fav: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  favOverlay: { position: 'absolute' },
});
