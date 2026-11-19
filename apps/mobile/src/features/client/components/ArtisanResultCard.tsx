import type { ArtisanCardDto } from '@depano/schemas';
import { ArtisanCard, Icon, Text, useTheme, type ArtisanCardProps } from '@depano/ui';
import { Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { features } from '@/lib/env';

/** Libellé de la mise en avant (abonnement « Promouvoir mon compte » de l'artisan). */
export const PROMOTED_LABEL = 'Mis en avant';

export function isPromoted(a: Pick<ArtisanCardDto, 'promoted'>): boolean {
  return a.promoted === true;
}

/** Carte artisan des résultats (accueil, recherche) avec la mention « Mis en avant » si l'artisan est promu. */
export function ArtisanResultCard({ showUrgent = features.urgent, ...rest }: ArtisanCardProps) {
  const t = useTheme();
  const props = { ...rest, showUrgent };
  if (!isPromoted(props.artisan)) return <ArtisanCard {...props} />;
  const c = t.colors.tone.brand;
  return (
    <View style={{ gap: t.spacing.xs }}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: t.spacing.sm, paddingVertical: 2, borderRadius: t.radius.full, backgroundColor: c.soft }}
        accessible
        accessibilityLabel={`${props.artisan.displayName} : profil mis en avant`}
        testID={`promoted-${props.artisan.id}`}
      >
        <Icon icon={Sparkles} size={14} color={c.text} />
        <Text variant="caption" weight="semibold" color={c.text}>
          {PROMOTED_LABEL}
        </Text>
      </View>
      <ArtisanCard {...props} />
    </View>
  );
}
