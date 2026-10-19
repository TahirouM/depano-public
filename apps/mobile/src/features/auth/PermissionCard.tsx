import { Button, Card, Chip, Icon, Text, useTheme } from '@depano/ui';
import { Bell, CircleCheck, MapPin, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getPermissionState, openSystemSettings, requestSystemPermission, type PermissionKind, type PermissionState } from '@/lib/permissions';

export const PERMISSION_COPY: Record<PermissionKind, { title: string; body: string; cta: string; degraded: string }> = {
  location: {
    title: 'Localisation',
    body: 'Pour trouver les artisans proches de chez vous et leur indiquer où venir. Uniquement quand l’app est ouverte.',
    cta: 'Autoriser la localisation',
    degraded: 'Sans localisation, vous saisirez votre adresse à la main.',
  },
  notifications: {
    title: 'Notifications',
    body: 'Pour suivre l’arrivée de l’artisan, recevoir ses messages et les demandes d’intervention.',
    cta: 'Activer les notifications',
    degraded: 'Sans notifications, pensez à ouvrir l’app pour suivre vos interventions.',
  },
};

/** Carte d'explication AVANT la popup système ; refus → message de mode dégradé. */
export function PermissionCard({ kind, onResult }: { kind: PermissionKind; onResult?: (granted: boolean) => void }) {
  const t = useTheme();
  const [state, setState] = useState<PermissionState | null>(null);
  const copy = PERMISSION_COPY[kind];
  useEffect(() => {
    void getPermissionState(kind).then(setState);
  }, [kind]);

  const ask = async () => {
    const granted = await requestSystemPermission(kind);
    setState(await getPermissionState(kind));
    onResult?.(granted);
  };

  return (
    <Card style={{ gap: t.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Icon icon={kind === 'location' ? MapPin : Bell} color={t.colors.text.brand} />
        <Text variant="title2" style={{ flex: 1 }}>
          {copy.title}
        </Text>
        {state === 'granted' ? <Chip size="sm" tone="success" icon={CircleCheck} label="Autorisée" /> : null}
      </View>
      <Text tone="secondary">{copy.body}</Text>
      {state === 'granted' ? null : state === 'blocked' || state === 'denied' ? (
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={TriangleAlert} size={18} color={t.colors.tone.warning.text} />
            <Text variant="callout" tone="warning" style={{ flex: 1 }}>
              {copy.degraded}
            </Text>
          </View>
          <Button label={state === 'blocked' ? 'Ouvrir les réglages' : copy.cta} variant="secondary" onPress={state === 'blocked' ? openSystemSettings : ask} />
        </View>
      ) : (
        <Button label={copy.cta} variant="secondary" onPress={ask} />
      )}
    </Card>
  );
}
