import { SpaceNativeTabs, type NativeTabDef } from '@/components/SpaceNativeTabs';

/**
 * Onglets client (iOS / Android) : tab bar système — Liquid Glass sur iOS 26, Material sur Android.
 * Web : `_layout.web.tsx` (tab bar JS). Chaque onglet garde sa pile (`TabStack`).
 */
const TABS: NativeTabDef[] = [
  { name: 'accueil', label: 'Accueil', sf: { default: 'house', selected: 'house.fill' }, md: 'home', testID: 'tab-accueil' },
  // Pas de role="search" : voir README (Liquid Glass) — l'écran a sa propre recherche + filtres.
  { name: 'recherche', label: 'Recherche', sf: { default: 'magnifyingglass', selected: 'magnifyingglass' }, md: 'search', testID: 'tab-recherche' },
  {
    name: 'activite',
    label: 'Activité',
    sf: { default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' },
    md: 'list_alt',
    testID: 'tab-activite',
    badge: 'activity',
  },
  {
    name: 'messages',
    label: 'Messages',
    sf: { default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' },
    md: 'forum',
    testID: 'tab-messages',
    badge: 'messages',
  },
  { name: 'profil', label: 'Profil', sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' }, md: 'account_circle', testID: 'tab-profil' },
];

export default function ClientTabsLayout() {
  return <SpaceNativeTabs as="client" tabs={TABS} />;
}
