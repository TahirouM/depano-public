'use client';

import type { Me } from '@depano/schemas';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { api } from '@/lib/api';

export type BackofficeRole = 'admin' | 'support';

interface Session {
  me: Me;
  role: BackofficeRole;
  isAdmin: boolean;
}

const SessionContext = createContext<Session | null>(null);

export function useMeQuery() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.me.get(), staleTime: 5 * 60_000 });
}

export function backofficeRole(me: Me): BackofficeRole | null {
  if (me.roles.includes('admin')) return 'admin';
  if (me.roles.includes('support')) return 'support';
  return null;
}

export function SessionProvider({ value, children }: { value: Session; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession hors de SessionProvider');
  return s;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  // Rechargement complet voulu : purge le cache des requêtes de la session précédente.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login');
}
