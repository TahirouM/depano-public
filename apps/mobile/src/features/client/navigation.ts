import { router, useNavigation, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * Quitte un parcours plein écran (urgence, RDV) vers un écran des onglets.
 * Un `replace` ou un `dismissTo` vers les onglets depuis la pile du parcours crée un second
 * navigateur d'onglets ou laisse l'onglet précédent intercepter les touches (web) : on retire
 * d'abord le parcours de la pile client, puis on ouvre l'écran comme depuis les onglets.
 */
export function useLeaveFlow() {
  const navigation = useNavigation();
  return useCallback(
    (href: Href) => {
      const flow = navigation.getParent();
      if (flow?.canGoBack()) flow.goBack();
      if (href === '/accueil') router.navigate('/accueil');
      else router.push(href);
    },
    [navigation],
  );
}
