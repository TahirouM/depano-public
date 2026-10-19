import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Activité — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Activité"
      description="Réservations, annulations, avis (réponse publique), messages."
      states="—" inTabs
    />
  );
}
