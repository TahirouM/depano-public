import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Aide — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Aide"
      description="FAQ client, contact support, médiateur de la consommation."
      states="—" inTabs
    />
  );
}
