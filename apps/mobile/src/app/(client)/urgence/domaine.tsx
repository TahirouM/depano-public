import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Urgence · Métier — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Urgence · Métier"
      description="Étape 1 sur 4 : 3 grandes tuiles (plomberie, électricité, énergétique). Brouillon : useDraft(DRAFT_KEYS.urgent)."
      states="—"
      links={[{ label: "Étape suivante : motif", href: "/urgence/motif" }]}
    />
  );
}
