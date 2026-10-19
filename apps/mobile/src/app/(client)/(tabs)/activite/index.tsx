import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Activité — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Activité"
      description="Onglets « En cours » / « Passées » (SegmentedControl) ; InterventionCard ; regroupe RDV en cours et historique."
      states="vide" inTabs
      links={[{ label: "Détail intervention (démo)", href: "/activite/demo" }]}
    />
  );
}
