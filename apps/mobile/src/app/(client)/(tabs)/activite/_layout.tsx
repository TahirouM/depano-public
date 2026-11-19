import { TabStack } from '@/components/TabStack';

export const unstable_settings = { anchor: 'index' };

/** Onglet « Rendez-vous » (dossier `activite` conservé : liens profonds et détail `/activite/{id}`). */
export default function Layout() {
  return <TabStack rootTitle="Mes rendez-vous" />;
}
