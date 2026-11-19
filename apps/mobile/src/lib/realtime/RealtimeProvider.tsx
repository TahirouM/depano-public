import type { ClientToServerEvents, ServerToClientEvents } from '@depano/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/app';
import { selectIsSignedIn, useAuthStore } from '@/stores/auth';
import { refreshTokens } from '../api';
import { env, features } from '../env';
import { createRealtimeHandlers } from './handlers';

export type DepanoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeCtx {
  socket: DepanoSocket | null;
  connected: boolean;
}

const Ctx = createContext<RealtimeCtx>({ socket: null, connected: false });

/**
 * Connexion Socket.IO liée à la session : ouverte à la connexion, fermée à la déconnexion,
 * jeton relu à chaque reconnexion (et rafraîchi si refusé).
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const signedIn = useAuthStore(selectIsSignedIn);
  const [state, setState] = useState<RealtimeCtx>({ socket: null, connected: false });
  const refreshing = useRef(false);

  useEffect(() => {
    // Démo statique : pas de serveur temps réel.
    if (!signedIn || env.demo) {
      setState({ socket: null, connected: false });
      return;
    }
    const socket: DepanoSocket = io(env.apiUrl, {
      transports: ['websocket'],
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    const handlers = createRealtimeHandlers(qc, {
      // Demande d'urgence : plein écran si l'artisan est dans son espace.
      onOffer: (offerId) => {
        if (features.urgent && useAppStore.getState().activeRole === 'artisan') router.push({ pathname: '/pro/offre/[id]', params: { id: offerId } });
      },
    });
    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event as keyof ServerToClientEvents, handler as never);
    }

    socket.on('connect', () => setState({ socket, connected: true }));
    socket.on('disconnect', () => setState({ socket, connected: false }));
    socket.on('connect_error', async (err) => {
      setState({ socket, connected: false });
      if (refreshing.current || !/unauthori|jwt|token|401/i.test(err.message)) return;
      refreshing.current = true;
      const ok = await refreshTokens();
      refreshing.current = false;
      if (ok) socket.connect();
    });

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !socket.connected) socket.connect();
    });

    setState({ socket, connected: socket.connected });
    return () => {
      sub.remove();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [signedIn, qc]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** `{ socket, connected }` — socket null pour un visiteur. */
export function useRealtime() {
  return useContext(Ctx);
}
