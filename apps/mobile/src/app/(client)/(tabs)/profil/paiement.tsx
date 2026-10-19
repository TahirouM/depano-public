import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Moyens de paiement — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Moyens de paiement"
      description="Cartes enregistrées (me.paymentMethods), ajout via SetupIntent Stripe."
      states="vide" inTabs
    />
  );
}
