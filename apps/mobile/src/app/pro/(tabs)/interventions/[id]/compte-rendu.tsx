import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Compte rendu — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Compte rendu"
      description="Réalisable oui/non, matériel, photos avant/après, note vocale transcrite, retour nécessaire (bookings.submitReport). Brouillon persisté."
      states="brouillon" inTabs
    />
  );
}
