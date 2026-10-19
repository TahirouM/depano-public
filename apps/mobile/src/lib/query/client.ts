import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { ApiError } from '@depano/schemas';
import { env } from '../env';

const DAY = 24 * 60 * 60 * 1000;

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && !error.isNetwork && error.status < 500 && error.status !== 429) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // gcTime ≥ maxAge de persistance, sinon le cache hors ligne serait vidé.
      gcTime: DAY,
      retry: shouldRetry,
      refetchOnReconnect: true,
    },
    mutations: {
      // Hors ligne, les mutations sont mises en pause puis rejouées au retour du réseau.
      networkMode: 'online',
      retry: (n, e) => (e instanceof ApiError && e.isNetwork ? n < 3 : false),
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'depano.query-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: DAY,
  buster: env.appVersion,
  dehydrateOptions: {
    // Lecture hors ligne : on persiste les requêtes réussies, sauf meta.persist === false.
    shouldDehydrateQuery: (q: { state: { status: string }; meta?: Record<string, unknown> }) =>
      q.state.status === 'success' && q.meta?.persist !== false,
    // File d'actions hors ligne : les mutations en pause survivent au redémarrage.
    shouldDehydrateMutation: (m: { state: { isPaused: boolean } }) => m.state.isPaused,
  },
};

let wired = false;
/** Branche onlineManager sur NetInfo et focusManager sur AppState (à appeler une fois). */
export function wireReactQueryToDevice() {
  if (wired) return;
  wired = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((s) => {
      setOnline(!!s.isConnected && s.isInternetReachable !== false);
    }),
  );
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
  }
}
