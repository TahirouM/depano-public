import { ArtisanCard, Screen, SkeletonList, useTheme } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { QueryView } from '@/components/QueryView';
import { useFavorites, useToggleFavorite } from '../queries';

/** Favoris : artisans enregistrés, retrait en optimiste. */
export function FavoritesScreen() {
  return (
    <AuthGate title="Favoris" message="Connectez-vous pour retrouver vos artisans favoris.">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useTheme();
  const q = useFavorites();
  const toggle = useToggleFavorite();
  return (
    <Screen inTabs refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: 'Favoris' }} />
      <QueryView
        query={q}
        loading={<SkeletonList count={3} />}
        isEmpty={(d) => d.length === 0}
        empty={{ icon: Heart, title: 'Aucun favori', message: 'Touchez le cœur sur la fiche d’un artisan pour le retrouver ici.', action: { label: 'Trouver un artisan', onPress: () => router.push('/recherche') } }}
      >
        {(list) => (
          <View style={{ gap: t.spacing.md }} testID="favorites">
            {list.map((a) => (
              <ArtisanCard
                key={a.id}
                artisan={a}
                favorite
                onToggleFavorite={() => toggle.mutate({ artisan: a, favorite: false })}
                onPress={() => router.push({ pathname: '/artisan/[id]', params: { id: a.id } })}
              />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
