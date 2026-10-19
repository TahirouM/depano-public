import { PlaceholderScreen } from '@/components/PlaceholderScreen';

/** Notation — à implémenter par l'agent client (plan, section 5). */
export default function Screen() {
  return (
    <PlaceholderScreen
      owner="client"
      title="Notation"
      description="Étoiles (StarRating input), tags, commentaire, photo (bookings.review)."
      states="déjà noté" inTabs
    />
  );
}
