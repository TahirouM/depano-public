import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Suivi en direct — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Suivi en direct"
      description="Carte, ETA, photo et nom de l'artisan, appel (bookings.callRelay) / chat (useBookingLive : booking.location)."
      states="retard, annulation artisan"
    />
  );
}
