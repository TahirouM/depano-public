import { SpaceNativeTabs, type NativeTabDef } from '@/components/SpaceNativeTabs';

/**
 * Onglets artisan (iOS / Android) : tab bar système — Liquid Glass sur iOS 26, Material sur Android.
 * Web : `_layout.web.tsx` (tab bar JS). Accent ardoise via `AccentScope` (pro/_layout.tsx).
 */
const TABS: NativeTabDef[] = [
  { name: 'accueil', label: 'Accueil', sf: { default: 'house', selected: 'house.fill' }, md: 'home', testID: 'tab-pro-accueil' },
  { name: 'planning', label: 'Planning', sf: { default: 'calendar', selected: 'calendar' }, md: 'calendar_month', testID: 'tab-pro-planning' },
  {
    name: 'interventions',
    label: 'Interventions',
    sf: { default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' },
    md: 'handyman',
    testID: 'tab-pro-interventions',
    badge: 'activity',
  },
  {
    name: 'messages',
    label: 'Messages',
    sf: { default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' },
    md: 'forum',
    testID: 'tab-pro-messages',
    badge: 'messages',
  },
  { name: 'profil', label: 'Profil', sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' }, md: 'account_circle', testID: 'tab-pro-profil' },
];

export default function ArtisanTabsLayout() {
  return <SpaceNativeTabs as="artisan" tabs={TABS} />;
}
