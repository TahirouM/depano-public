import { IconButton, PinnedInterventionBar } from '@depano/ui';
import { router, Stack, usePathname, type Href, type NativeStackNavigationOptions } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBell } from './HeaderBell';
import { useStackOptions } from './navigation';
import { useStackPinnedIntervention } from './PinnedInterventionHost';

/** Pile de navigation d'un onglet : chaque onglet garde son historique. */
export function TabStack({ rootTitle, bell = true }: { rootTitle: string; bell?: boolean }) {
  const options = useStackOptions();
  const stack = (
    <Stack
      screenOptions={({ navigation, route }) => ({
        ...options,
        // Écran ouvert depuis un autre onglet (ex. « Message » d'un rendez-vous → discussion) : il est seul
        // dans la pile de cet onglet, donc sans retour natif. On ramène alors à l'accueil de l'onglet.
        headerLeft:
          // canGoBack() ne convient pas : il remonte aux onglets (historique d'onglets) et répond vrai.
          route.name !== 'index' && navigation.getState().routes[0]?.key === route.key
            ? () => <BackToTabRoot />
            : undefined,
      })}
    >
      <Stack.Screen name="index" options={{ title: rootTitle, headerRight: bell ? () => <HeaderBell /> : undefined }} />
    </Stack>
  );
  return <WithPinnedIntervention>{stack}</WithPinnedIntervention>;
}

/** Retour vers l'écran d'accueil de l'onglet (/messages/123 → /messages, /pro/messages/123 → /pro/messages). */
export function tabRootOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return `/${parts.slice(0, parts[0] === 'pro' ? 2 : 1).join('/')}`;
}

function BackToTabRoot() {
  const pathname = usePathname();
  return <HeaderBackButton onPress={() => router.replace(tabRootOf(pathname) as Href)} testID="header-back-root" />;
}

/** Bouton retour d'en-tête dessiné à la main (même rendu que le retour natif : chevron iOS, flèche Android). */
export function HeaderBackButton({ onPress, testID = 'header-back' }: { onPress: () => void; testID?: string }) {
  return (
    <IconButton
      icon={Platform.OS === 'ios' ? ChevronLeft : ArrowLeft}
      accessibilityLabel="Retour"
      onPress={onPress}
      style={{ marginLeft: Platform.OS === 'ios' ? -12 : -8 }}
      testID={testID}
    />
  );
}

type ScreenOptionsArgs = { navigation: { getState: () => { routes: { key: string }[] }; getParent: () => { canGoBack: () => boolean; goBack: () => void } | undefined }; route: { key?: string } };

/**
 * Premier écran d'une pile imbriquée (parcours RDV / urgence, paramètres, onboarding pro) : le retour natif
 * ne remonte pas à la pile parente, l'écran n'aurait donc aucun retour. On ajoute un retour qui ferme la
 * pile (retour à l'écran d'origine), ou ramène à `fallback` après un lien profond à froid.
 * Un écran peut toujours le masquer (`headerLeft: () => null`, ex. recherche d'artisan en cours).
 */
export function nestedStackScreenOptions(base: NativeStackNavigationOptions, fallback: Href = '/') {
  return ({ navigation, route }: ScreenOptionsArgs): NativeStackNavigationOptions => {
    if (navigation.getState().routes[0]?.key !== route.key) return base;
    const leave = () => {
      const parent = navigation.getParent();
      if (parent?.canGoBack()) parent.goBack();
      else router.replace(fallback);
    };
    return { ...base, headerLeft: () => <HeaderBackButton onPress={leave} /> };
  };
}

/**
 * Tabs natives sans accessoire (Android, iOS < 26) : la hauteur de la tab bar n'est pas mesurable,
 * donc l'intervention épinglée n'est pas positionnée en absolu. Elle occupe le bas du contenu de
 * l'onglet, qui se termine déjà juste au-dessus de la tab bar :
 * - Android : le contenu de l'onglet est placé au-dessus de la tab bar → aucun décalage ;
 * - iOS : la tab bar flotte au-dessus du contenu ; le SafeAreaProvider de l'onglet donne sa hauteur
 *   dans `insets.bottom` → on le met sous la barre, et la pile au-dessus reçoit un inset bas nul.
 * Sur web (tab bar JS) et iOS 26 (accessoire natif), rien n'est rendu ici.
 */
function WithPinnedIntervention({ children }: { children: ReactNode }) {
  const pinned = useStackPinnedIntervention();
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === 'ios' ? insets.bottom : 0;
  // Arbre stable (la pile ne doit jamais être remontée quand la barre apparaît : historique conservé).
  return (
    <View style={styles.flex} collapsable={false}>
      <SafeAreaInsetsContext.Provider value={pinned ? { ...insets, bottom: 0 } : insets}>
        <View style={styles.flex} collapsable={false}>
          {children}
        </View>
      </SafeAreaInsetsContext.Provider>
      {pinned ? (
        <View style={{ paddingTop: 6, paddingBottom: bottom }}>
          <PinnedInterventionBar {...pinned} surface="glass" />
        </View>
      ) : null}
    </View>
  );
}

/** Pile d'un parcours plein écran (urgence, RDV, onboarding pro) : pas de tab bar. */
export function FlowStack() {
  const options = useStackOptions();
  return <Stack screenOptions={nestedStackScreenOptions({ ...options, gestureEnabled: true }, '/accueil')} />;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
