import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Vérification en cours — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Vérification en cours"
      description="Statut « en vérification », checklist, délai annoncé (48 h ouvrées) ; notification à la validation."
      states="refusé"
    />
  );
}
