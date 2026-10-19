import { Phone } from '@depano/schemas';
import { Button, Card, Chip, Screen, Text, TextField, useTheme } from '@depano/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { SocialButtons } from '@/features/auth/SocialButtons';
import { useAuthStore } from '@/stores/auth';

const DEMO = [
  { label: 'Client démo', phone: '+33600000010' },
  { label: 'Artisan démo', phone: '+33600000101' },
];

/** Connexion / inscription : numéro de mobile → code SMS. Pas de mot de passe. */
export default function Connexion() {
  const t = useTheme();
  const reason = useAuthStore((s) => s.authReason);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = Phone.safeParse(phone);
    if (!parsed.success) {
      setError('Saisissez un numéro de mobile valide, par exemple 06 12 34 56 78.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await api.auth.requestOtp({ phone: parsed.data });
      router.push({
        pathname: '/code',
        params: { phone: parsed.data, retry: String(r.retryAfterSeconds ?? 60), ...(r.devCode ? { devCode: r.devCode } : {}) },
      });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button label="Recevoir le code" onPress={submit} loading={loading} size="lg" fullWidth testID="request-otp" />}>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title1">Connexion ou inscription</Text>
          <Text tone="secondary">
            {reason ?? 'Recevez un code par SMS. Pas de mot de passe à retenir.'}
          </Text>
        </View>
        <TextField
          label="Numéro de mobile"
          placeholder="06 12 34 56 78"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          value={phone}
          onChangeText={setPhone}
          onSubmitEditing={submit}
          returnKeyType="send"
          error={error}
          helper="L'artisan pourra vous joindre via un numéro masqué."
          testID="phone-input"
        />
        {__DEV__ ? (
          <Card variant="flat" style={{ gap: t.spacing.sm }}>
            <Text variant="overline" tone="secondary">
              Comptes de démo (dev)
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {DEMO.map((d) => (
                <Chip key={d.phone} label={d.label} onPress={() => setPhone(d.phone)} />
              ))}
            </View>
          </Card>
        ) : null}
        <SocialButtons />
        <Text variant="caption" tone="secondary">
          En continuant, vous acceptez les conditions générales d'utilisation et la politique de confidentialité de DEPANO.
        </Text>
      </View>
    </Screen>
  );
}
