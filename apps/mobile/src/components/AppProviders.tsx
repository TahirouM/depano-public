import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { INTER_FAMILIES, OfflineBanner, ThemeProvider, ToastProvider, useTheme } from '@depano/ui';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Appearance, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOnline, usePausedMutationCount } from '@/lib/online';
import { persistOptions, queryClient, wireReactQueryToDevice } from '@/lib/query/client';
import { registerMutationDefaults } from '@/lib/query/mutations';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';
import { useAppStore } from '@/stores/app';
import { RoleSwitchProvider } from './RoleSwitch';

wireReactQueryToDevice();
registerMutationDefaults(queryClient);

export function useAppFonts() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  // En cas d'échec de chargement, on garde la police système (SF Pro / Roboto).
  return { ready: loaded || !!error, inter: loaded && !error };
}

/** Bannière hors ligne en bas de l'écran ; la navigation remonte d'autant (rien n'est masqué). */
function OfflineLayout({ children }: { children: ReactNode }) {
  const online = useIsOnline();
  const pending = usePausedMutationCount();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  if (online) return <>{children}</>;
  return (
    <View style={styles.flex}>
      <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: 0 }}>
        <View style={styles.flex}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      <View style={{ paddingBottom: insets.bottom, backgroundColor: t.colors.tone.warning.soft }}>
        <OfflineBanner visible pendingCount={pending} />
      </View>
    </View>
  );
}

function ThemedApp({ children, inter }: { children: ReactNode; inter: boolean }) {
  const scheme = useAppStore((s) => s.scheme);
  const role = useAppStore((s) => s.activeRole);
  // iOS : aligne le style d'interface natif sur le thème choisi dans l'app. Indispensable au
  // Liquid Glass (tab bar, accessoire, en-têtes) : DynamicColorIOS / PlatformColor et le verre
  // se résolvent sur ce style, pas sur notre thème JS.
  useEffect(() => {
    if (Platform.OS === 'ios') Appearance.setColorScheme(scheme === 'system' ? 'unspecified' : scheme);
  }, [scheme]);
  return (
    <ThemeProvider scheme={scheme} accent={role} fonts={inter ? INTER_FAMILIES : null}>
      <ThemedStatusBar />
      {children}
    </ThemeProvider>
  );
}

function ThemedStatusBar() {
  const t = useTheme();
  return <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />;
}

export function AppProviders({ children, inter }: { children: ReactNode; inter: boolean }) {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={() => void queryClient.resumePausedMutations()}>
          <ThemedApp inter={inter}>
            <ToastProvider>
              <RealtimeProvider>
                <RoleSwitchProvider>
                  <OfflineLayout>{children}</OfflineLayout>
                </RoleSwitchProvider>
              </RealtimeProvider>
            </ToastProvider>
          </ThemedApp>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
