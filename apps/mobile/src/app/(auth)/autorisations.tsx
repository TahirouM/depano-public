import { Button, Screen, Text, useTheme } from '@depano/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { PermissionCard } from '@/features/auth/PermissionCard';
import { finishAuthFlow } from '@/lib/session';

/** Autorisations expliquées avant chaque popup système (localisation, notifications). */
export default function Autorisations() {
  const t = useTheme();
  const { suite } = useLocalSearchParams<{ suite?: string }>();
  const next = () => {
    if (suite === 'pro') router.dismissTo('/pro/onboarding');
    else finishAuthFlow();
  };
  return (
    <Screen
      footer={
        <>
          <Button label="Continuer" onPress={next} size="lg" fullWidth />
          <Button label="Plus tard" variant="ghost" onPress={next} fullWidth />
        </>
      }
    >
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title1">Deux autorisations utiles</Text>
          <Text tone="secondary">Vous pouvez les accorder maintenant ou plus tard, au moment où elles servent.</Text>
        </View>
        <PermissionCard kind="location" />
        <PermissionCard kind="notifications" />
      </View>
    </Screen>
  );
}
