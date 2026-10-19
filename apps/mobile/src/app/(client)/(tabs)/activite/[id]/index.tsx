import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Détail intervention — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Détail intervention"
      description="Timeline des statuts datés, artisan, prix, code de fin (completionCode), devis à valider, actions (annuler, litige, chat)."
      states="chaque statut" inTabs
      links={[{ label: "Validation de devis", href: "/activite/demo/devis" }, { label: "Fin d'intervention", href: "/activite/demo/fin" }, { label: "Notation", href: "/activite/demo/notation" }]}
    />
  );
}
