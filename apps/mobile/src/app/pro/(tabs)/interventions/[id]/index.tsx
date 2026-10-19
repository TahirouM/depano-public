import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Détail intervention — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Détail intervention"
      description="Client, adresse (ouvrir dans Maps), appel / chat, bouton d'action selon statut (« Y aller » → en_route, partage de position)."
      states="chaque statut" inTabs
      links={[{ label: "Devis sur place", href: "/pro/interventions/demo/devis" }, { label: "Compte rendu", href: "/pro/interventions/demo/compte-rendu" }, { label: "Code de fin", href: "/pro/interventions/demo/code" }]}
    />
  );
}
