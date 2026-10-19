import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Statistiques — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Statistiques"
      description="CA par mois, taux d'acceptation, note moyenne (artisan.stats)."
      states="—" inTabs
    />
  );
}
