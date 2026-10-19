import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Ajouter une indisponibilité — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Ajouter une indisponibilité"
      description="Congés / indispo perso (artisan.addException) — idéalement en bottom sheet."
      states="—" inTabs
    />
  );
}
