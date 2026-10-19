import { ProfileScreen } from '@/features/profile/ProfileScreen';

/** Fondations posées (identité, rôle, paramètres) ; l'agent client complète les sous-écrans. */
export default function ClientProfile() {
  return <ProfileScreen as="client" />;
}
