import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Documents — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Documents"
      description="Pièce d'identité, assurance décennale / RC pro (uploadFile purpose document + artisan.addDocument), IBAN via Stripe (payoutOnboardingLink)."
      states="document refusé, expiré"
    />
  );
}
