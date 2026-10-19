import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Fin d'intervention — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Fin d'intervention"
      description="Code 4 chiffres à donner à l'artisan, « Que s'est-il passé ? » (litige : jamais venu, déplacement seulement…)."
      states="—" inTabs
    />
  );
}
