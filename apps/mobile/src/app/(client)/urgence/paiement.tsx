import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Urgence · Prix et paiement — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Urgence · Prix et paiement"
      description="Étape 4 sur 4 : fourchette annoncée, frais d'urgence, garantie, total TTC (PriceSummary), renonciation au droit de rétractation, Apple Pay. requireAuth() avant de payer."
      states="paiement refusé"
      links={[{ label: "Recherche d'artisan (démo)", href: "/urgence/demo/recherche" }]}
    />
  );
}
