import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@depano/schemas';
import { Button, Card, ErrorState, Screen, Switch, Text, useTheme, useToast } from '@depano/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { askPermission, getPermissionState, openSystemSettings, type PermissionState } from '@/lib/permissions';
import { errorMessage } from '@/lib/api';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '@/lib/query/hooks';

/** Notifications : état de la permission système + préférences push par type (enregistrées sur le compte). */
export default function NotificationSettings() {
  const t = useTheme();
  const toast = useToast();
  const query = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const prefs = query.data ?? DEFAULT_NOTIFICATION_PREFS;
  const setPref = (k: keyof NotificationPrefs, v: boolean) =>
    update.mutate({ [k]: v }, { onError: (e) => toast.error(errorMessage(e, 'Préférence non enregistrée. Réessayez.')) });
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
        {query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : null}
        <View style={{ opacity: query.isPending ? 0.5 : 1 }} pointerEvents={query.isPending ? 'none' : 'auto'}>
          <Switch label="Suivi des interventions" description="Acceptation, artisan en route, devis, fin" value={prefs.bookingUpdates} onValueChange={(v) => setPref('bookingUpdates', v)} />
          <Switch label="Messages" description="Nouveaux messages de votre interlocuteur" value={prefs.messages} onValueChange={(v) => setPref('messages', v)} />
          <Switch label="Rappels" description="La veille et 1 h avant un rendez-vous" value={prefs.reminders} onValueChange={(v) => setPref('reminders', v)} />
          <Switch label="Offres et nouveautés" value={prefs.marketing} onValueChange={(v) => setPref('marketing', v)} />
        </View>
        <Text variant="caption" tone="secondary">
          Ces réglages concernent les notifications push : tout reste visible dans l'onglet Notifications. Les demandes d'urgence (artisans), la sécurité du compte et les paiements sont toujours envoyés.
        </Text>
      </View>
    </Screen>
  );
}
