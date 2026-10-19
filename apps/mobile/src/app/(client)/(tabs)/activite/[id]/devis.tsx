import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Validation de devis — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Validation de devis"
      description="Lignes, total TTC, accepter / refuser (bookings.answerQuote ; nouvelle empreinte si dépassement > 20 %)."
      states="expiré" inTabs
    />
  );
}
