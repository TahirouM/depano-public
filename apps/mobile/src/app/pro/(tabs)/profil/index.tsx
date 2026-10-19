import { ProfileScreen } from '@/features/profile/ProfileScreen';

/** Fondations posées (identité, rôle, paramètres) ; l'agent artisan complète les sous-écrans. */
export default function ArtisanProfile() {
  return <ProfileScreen as="artisan" />;
}
