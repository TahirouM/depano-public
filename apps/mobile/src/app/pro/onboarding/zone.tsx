import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Zone d'intervention — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Zone d'intervention"
      description="Rayon sur carte et horaires types (artisan.updateProfile, setAvailabilityRules)."
      states="—"
    />
  );
}
