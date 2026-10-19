import { Button, Card, Icon, Screen, Skeleton, Text, useTheme, useToast } from '@depano/ui';
import { Stack } from 'expo-router';
import { Gift, Share2 } from 'lucide-react-native';
import { Platform, Share, View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { useMe } from '@/lib/query/hooks';

/** Code de parrainage stable, dérivé de l'identifiant (pas encore d'endpoint dédié côté API). */
export function referralCode(userId: string): string {
  return `DEPANO-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function ReferralScreen() {
  return (
    <AuthGate title="Parrainage" message="Connectez-vous pour obtenir votre code de parrainage.">
      <Inner />
    </AuthGate>
  );
}

function Inner() {
  const t = useTheme();
  const toast = useToast();
  const me = useMe();
  const code = me.data ? referralCode(me.data.id) : null;
  const message = code
    ? `J'utilise DEPANO pour trouver des artisans vérifiés à Marseille, avec un prix connu d'avance. Inscris-toi avec mon code ${code} : https://depano.fr/parrainage/${code}`
    : '';

  const share = async () => {
    if (!code) return;
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
        if (nav.share) await nav.share({ text: message });
        else {
          await navigator.clipboard.writeText(message);
          toast.success('Lien copié.');
        }
        return;
      }
      await Share.share({ message });
    } catch {
      // partage annulé
    }
  };

  return (
    <Screen inTabs footer={<Button size="lg" fullWidth icon={Share2} label="Partager mon code" disabled={!code} onPress={() => void share()} testID="share-referral" />}>
      <Stack.Screen options={{ title: 'Parrainage' }} />
      <View style={{ gap: t.spacing.xl, alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: t.spacing.md, paddingTop: t.spacing.lg }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.background.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Gift} size={48} color={t.colors.text.brand} />
          </View>
          <Text variant="title1" align="center">
            Faites découvrir DEPANO
          </Text>
          <Text tone="secondary" align="center">
            Vos proches profitent d'artisans vérifiés, d'un prix connu d'avance et d'un paiement seulement à la fin.
          </Text>
        </View>
        <Card variant="brand" style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="label" tone="brand">
            Votre code
          </Text>
          {code ? (
            <Text variant="display" selectable testID="referral-code" accessibilityLabel={`Votre code : ${code.split('').join(' ')}`}>
              {code}
            </Text>
          ) : (
            <Skeleton width={200} height={40} />
          )}
        </Card>
        <Text variant="callout" tone="secondary" align="center">
          Les avantages du parrainage vous seront communiqués par notification dès leur lancement.
        </Text>
      </View>
    </Screen>
  );
}
