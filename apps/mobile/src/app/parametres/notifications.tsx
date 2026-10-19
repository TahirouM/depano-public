import { Button, Card, Screen, Switch, Text, useTheme } from '@depano/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { askPermission, getPermissionState, openSystemSettings, type PermissionState } from '@/lib/permissions';
import { useAppStore } from '@/stores/app';

/** Notifications : état de la permission système + préférences par type. */
export default function NotificationSettings() {
  const t = useTheme();
  const prefs = useAppStore((s) => s.notificationPrefs);
  const setPref = useAppStore((s) => s.setNotificationPref);
  const [state, setState] = useState<PermissionState | null>(null);
  useFocusEffect(
    useCallback(() => {
      void getPermissionState('notifications').then(setState);
    }, []),
  );

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        {state && state !== 'granted' ? (
          <Card variant="brand" style={{ gap: t.spacing.md }}>
            <Text variant="title2">Notifications désactivées</Text>
            <Text tone="secondary">Activez-les pour suivre l'arrivée de l'artisan et ne manquer aucun message.</Text>
            <Button
              label={state === 'blocked' ? 'Ouvrir les réglages' : 'Activer les notifications'}
              onPress={async () => {
                if (state === 'blocked') return openSystemSettings();
                await askPermission('notifications', 'Restez informé en temps réel');
                setState(await getPermissionState('notifications'));
              }}
            />
          </Card>
        ) : null}
        <View>
          <Switch label="Suivi des interventions" description="Acceptation, artisan en route, devis, fin" value={prefs.bookingUpdates} onValueChange={(v) => setPref('bookingUpdates', v)} />
          <Switch label="Messages" description="Nouveaux messages de votre interlocuteur" value={prefs.messages} onValueChange={(v) => setPref('messages', v)} />
          <Switch label="Rappels" description="La veille et 1 h avant un rendez-vous" value={prefs.reminders} onValueChange={(v) => setPref('reminders', v)} />
          <Switch label="Offres et nouveautés" value={prefs.marketing} onValueChange={(v) => setPref('marketing', v)} />
        </View>
        <Text variant="caption" tone="secondary">
          Les notifications liées à la sécurité de votre compte et au paiement sont toujours envoyées.
        </Text>
      </View>
    </Screen>
  );
}
