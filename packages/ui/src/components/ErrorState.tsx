import { TriangleAlert, WifiOff } from 'lucide-react-native';
import { EmptyState } from './EmptyState';

export interface ErrorStateProps {
  /** Message humain (ApiError.message est déjà rédigé pour l'utilisateur). */
  message?: string;
  title?: string;
  offline?: boolean;
  onRetry?: () => void;
  fill?: boolean;
}

/** Erreur : message humain + « Réessayer ». */
export function ErrorState({ message, title, offline, onRetry, fill = true }: ErrorStateProps) {
  return (
    <EmptyState
      fill={fill}
      icon={offline ? WifiOff : TriangleAlert}
      title={title ?? (offline ? 'Vous êtes hors ligne' : 'Un souci est survenu')}
      message={
        message ??
        (offline
          ? 'Vérifiez votre connexion. Les informations déjà chargées restent consultables.'
          : 'Ce n\'est pas de votre faute. Réessayez dans un instant.')
      }
      action={onRetry ? { label: 'Réessayer', onPress: onRetry, variant: 'secondary' } : undefined}
    />
  );
}

