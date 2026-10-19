import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Planning — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Planning"
      description="Mois + jour, légende par type (couleurs domaine), ajout d'indispo perso (artisan.planning)."
      states="vide" inTabs
      links={[{ label: "Ajouter une indisponibilité", href: "/pro/planning/indisponibilite" }]}
    />
  );
}
