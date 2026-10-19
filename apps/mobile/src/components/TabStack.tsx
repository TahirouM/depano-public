import { PinnedInterventionBar } from '@depano/ui';
import { Stack } from 'expo-router';
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
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: rootTitle, headerRight: bell ? () => <HeaderBell /> : undefined }} />
    </Stack>
  );
  return <WithPinnedIntervention>{stack}</WithPinnedIntervention>;
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
  return <Stack screenOptions={{ ...options, gestureEnabled: true }} />;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
