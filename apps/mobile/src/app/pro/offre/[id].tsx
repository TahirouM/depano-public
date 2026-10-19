import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Demande d'urgence — à implémenter par l'agent artisan (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="artisan"
      title="Demande d'urgence"
      description="Plein écran : motif, distance, prix, compte à rebours 60 s, accepter / refuser (artisan.acceptOffer / declineOffer). Ouvert automatiquement sur offer.created."
      states="prise par un autre (offer.revoked)"
    />
  );
}
