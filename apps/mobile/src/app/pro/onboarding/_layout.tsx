import { Button } from '@depano/ui';
import { Stack } from 'expo-router';
import { useSwitchRole } from '@/components/RoleSwitch';
import { useStackOptions } from '@/components/navigation';
import { nestedStackScreenOptions } from '@/components/TabStack';

/** Parcours KYC plein écran ; on peut toujours revenir à l'espace client. */
export default function Layout() {
  const options = useStackOptions();
  const switchRole = useSwitchRole();
  return (
    <Stack screenOptions={nestedStackScreenOptions({ ...options, gestureEnabled: true }, '/pro/onboarding')}>
      <Stack.Screen
        name="index"
        options={{
          headerLeft: () => (
            <Button
              label="Espace client"
              variant="ghost"
              size="sm"
              onPress={() => void switchRole('client')}
              accessibilityHint="Quitter l'inscription artisan et revenir à l'espace client"
            />
          ),
        }}
      />
    </Stack>
  );
}
