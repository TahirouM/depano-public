import { Stack, SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { AppProviders, useAppFonts } from '@/components/AppProviders';
import { useStackOptions } from '@/components/navigation';
import { useStoresHydrated } from '@/lib/hydration';
import { registerPushTokenIfGranted, useNotificationRouting } from '@/lib/push';
import { useIsSignedIn } from '@/lib/query/hooks';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fonts = useAppFonts();
  const hydrated = useStoresHydrated();
  const ready = fonts.ready && hydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <AppProviders inter={fonts.inter}>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const stack = useStackOptions();
  const signedIn = useIsSignedIn();
  useNotificationRouting(true);
  useEffect(() => {
    if (signedIn) void registerPushTokenIfGranted();
  }, [signedIn]);

  return (
    <Stack screenOptions={{ ...stack, headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="(client)" />
      <Stack.Screen name="pro" />
      <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
      <Stack.Screen name="autorisation/[kind]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
      <Stack.Screen name="parametres" />
      <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Page introuvable' }} />
    </Stack>
  );
}
