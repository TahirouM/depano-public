/**
 * Onglets de l'espace client, dans l'ordre de la maquette : partagés par la tab bar native
 * (`(tabs)/_layout.tsx`) et la tab bar web (`_layout.web.tsx`), qui n'ajoutent que les icônes.
 * La recherche n'est plus un onglet : elle s'ouvre depuis la barre de l'accueil (`/recherche`).
 */
export interface ClientTab {
  /** Dossier de la route sous `(client)/(tabs)`. */
  name: 'accueil' | 'activite' | 'interventions' | 'messages' | 'profil';
  label: string;
  testID: string;
  badge?: 'activity' | 'messages';
}

export const CLIENT_TABS: readonly ClientTab[] = [
  { name: 'accueil', label: 'Accueil', testID: 'tab-accueil' },
  // Dossier `activite` conservé : `/activite/{id}` reste la cible des liens profonds d'intervention.
  { name: 'activite', label: 'Rendez-vous', testID: 'tab-rendez-vous', badge: 'activity' },
  { name: 'interventions', label: 'Interventions', testID: 'tab-interventions' },
  { name: 'messages', label: 'Messages', testID: 'tab-messages', badge: 'messages' },
  { name: 'profil', label: 'Profil', testID: 'tab-profil' },
];

export function clientTab(name: ClientTab['name']): ClientTab {
  return CLIENT_TABS.find((t) => t.name === name)!;
}
