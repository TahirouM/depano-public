import { EmptyState, type LucideIcon } from '@depano/ui';
import type { ReactNode } from 'react';
import { LogIn } from 'lucide-react-native';
import { useIsSignedIn } from '@/lib/query/hooks';
import { useRequireAuth } from '@/lib/useRequireAuth';

export interface AuthGateProps {
  children: ReactNode;
  title: string;
  message: string;
  icon?: LucideIcon;
}

/** Pour les écrans entièrement réservés aux comptes : un visiteur voit une invitation. */
export function AuthGate({ children, title, message, icon = LogIn }: AuthGateProps) {
  const signedIn = useIsSignedIn();
  const requireAuth = useRequireAuth();
  if (signedIn) return <>{children}</>;
  return <EmptyState fill icon={icon} title={title} message={message} action={{ label: 'Se connecter', onPress: () => requireAuth() }} />;
}
