import type { ArtisanCardDto } from '@depano/schemas';
import { ArtisanCard, useTheme } from '@depano/ui';
import { Heart } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

/**
 * Carte artisan + bouton favori posé par-dessus (et non imbriqué dans la carte cliquable :
 * un bouton dans un bouton est invalide sur le web et gêne les lecteurs d'écran).
 */
export function FavoriteArtisanCard({ artisan, favorite, onToggleFavorite, onPress }: { artisan: ArtisanCardDto; favorite: boolean; onToggleFavorite: () => void; onPress: () => void }) {
  const t = useTheme();
  return (
    <View>
      <ArtisanCard artisan={artisan} onPress={onPress} />
      <View style={{ position: 'absolute', top: t.spacing.sm, right: t.spacing.sm }}>
        <Pressable
          onPress={onToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel={favorite ? `Retirer ${artisan.displayName} des favoris` : `Ajouter ${artisan.displayName} aux favoris`}
          accessibilityState={{ selected: favorite }}
          hitSlop={4}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          testID={`fav-${artisan.id}`}
        >
          <Heart size={24} color={t.colors.tone.urgent.text} fill={favorite ? t.colors.tone.urgent.text : 'transparent'} />
        </Pressable>
      </View>
    </View>
  );
}
