import { Button, Icon, Screen, Text, useTheme } from '@depano/ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Bell, MapPin } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { PERMISSION_COPY } from '@/features/auth/PermissionCard';
import { requestSystemPermission, settlePermissionPrompt, type PermissionKind } from '@/lib/permissions';

/** Écran d'explication contextuel ouvert par askPermission(kind, reason). */
export default function PermissionExplainer() {
  const t = useTheme();
  const params = useLocalSearchParams<{ kind: string; reason?: string }>();
  const kind: PermissionKind = params.kind === 'notifications' ? 'notifications' : 'location';
  const copy = PERMISSION_COPY[kind];
  const settled = useRef(false);

  const done = (granted: boolean) => {
    if (settled.current) return;
    settled.current = true;
    settlePermissionPrompt(granted);
    if (router.canGoBack()) router.back();
  };

  // Fermeture par geste : on considère un refus (mode dégradé).
  useEffect(
    () => () => {
      if (!settled.current) settlePermissionPrompt(false);
    },
    [],
  );

  return (
    <Screen
      footer={
        <>
          <Button label={copy.cta} size="lg" fullWidth onPress={async () => done(await requestSystemPermission(kind))} />
          <Button label="Plus tard" variant="ghost" fullWidth onPress={() => done(false)} />
        </>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: t.spacing.lg, paddingVertical: t.spacing.xxl }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: t.colors.background.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={kind === 'location' ? MapPin : Bell} size={56} color={t.colors.text.brand} strokeWidth={1.5} />
        </View>
        <Text variant="title1" align="center">
          {params.reason ?? copy.title}
        </Text>
        <Text tone="secondary" align="center">
          {copy.body}
        </Text>
      </View>
    </Screen>
  );
}
