import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Adresses — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Adresses"
      description="Adresses enregistrées (me.addresses), ajout avec autocomplétion, adresse par défaut."
      states="vide" inTabs
    />
  );
}
