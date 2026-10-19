import type { SessionDto } from '@depano/schemas';
import { Badge, Button, Card, Icon, ListItem, Screen, SkeletonList, Text, formatDateTime, useTheme, useToast } from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Smartphone } from 'lucide-react-native';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { api, errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { optimistic } from '@/lib/query/optimistic';
import { useSessions } from '@/lib/query/hooks';
import { qk } from '@/lib/query/keys';

/** Sécurité : appareils connectés (révocables) et passkeys. Pas de mot de passe chez DEPANO. */
export default function Security() {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const sessions = useSessions();

  // Exemple de référence du helper optimistic() : la ligne disparaît tout de suite.
  const revoke = useMutation({
    mutationFn: (id: string) => api.auth.revokeSession(id),
    ...optimistic<SessionDto[], string>(qc, {
      queryKey: () => qk.sessions,
      update: (old, id) => old?.filter((s) => s.id !== id),
      onError: (e) => toast.error(errorMessage(e)),
    }),
    onSuccess: () => toast.success('Appareil déconnecté'),
  });

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title2">Appareils connectés</Text>
          <Text tone="secondary">Déconnectez à distance un téléphone perdu ou que vous n'utilisez plus.</Text>
        </View>
        <QueryView query={sessions} loading={<SkeletonList variant="row" count={2} />} isEmpty={(d) => d.length === 0} empty={{ icon: Smartphone, title: 'Aucun appareil' }}>
          {(list) => (
            <SettingsSection>
              {list.map((s) => (
                <ListItem
                  key={s.id}
                  icon={Smartphone}
                  title={s.deviceName ?? 'Appareil inconnu'}
                  subtitle={`Dernière activité : ${formatDateTime(s.lastUsedAt)}`}
                  right={
                    s.current ? (
                      <Badge label="Cet appareil" tone="success" />
                    ) : (
                      <Button label="Déconnecter" variant="ghost" size="sm" onPress={() => revoke.mutate(s.id)} accessibilityLabel={`Déconnecter ${s.deviceName ?? 'cet appareil'}`} />
                    )
                  }
                />
              ))}
            </SettingsSection>
          )}
        </QueryView>

        <Card variant="brand" style={{ gap: t.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <Icon icon={Fingerprint} color={t.colors.text.brand} />
            <Text variant="title2" style={{ flex: 1 }}>
              Passkeys
            </Text>
            {!features.passkeys ? <Badge label="Bientôt" tone="info" /> : null}
          </View>
          <Text tone="secondary">Connectez-vous avec Face ID ou votre empreinte, sans attendre de SMS.</Text>
          <Button label="Créer une passkey" variant="secondary" disabled={!features.passkeys} fullWidth />
        </Card>
      </View>
    </Screen>
  );
}
