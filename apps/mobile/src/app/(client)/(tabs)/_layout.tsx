import { SpaceNativeTabs, type NativeTabDef } from '@/components/SpaceNativeTabs';
import { CLIENT_TABS, type ClientTab } from '@/lib/clientTabs';

/** Icônes système de chaque onglet (SF Symbols iOS, Material Symbols Android). */
const ICONS: Record<ClientTab['name'], Pick<NativeTabDef, 'sf' | 'md'>> = {
  accueil: { sf: { default: 'house', selected: 'house.fill' }, md: 'home' },
  activite: { sf: { default: 'calendar', selected: 'calendar' }, md: 'calendar_month' },
  interventions: { sf: { default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }, md: 'build' },
  messages: { sf: { default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }, md: 'forum' },
  profil: { sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' }, md: 'account_circle' },
};

/**
 * Onglets client (iOS / Android) : tab bar système — Liquid Glass sur iOS 26, Material sur Android.
 * Web : `_layout.web.tsx` (tab bar JS). Chaque onglet garde sa pile (`TabStack`). Ordre et libellés : `lib/clientTabs.ts`.
 */
const TABS: NativeTabDef[] = CLIENT_TABS.map((tab) => ({ ...tab, ...ICONS[tab.name] }));

export default function ClientTabsLayout() {
  return <SpaceNativeTabs as="client" tabs={TABS} />;
}
