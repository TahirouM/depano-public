import { RULES } from '@depano/schemas';
import { Button, Chip, OtpInput, Screen, Text, haptic, useTheme } from '@depano/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { FlaskConical } from 'lucide-react-native';
import { api, errorMessage } from '@/lib/api';
import { continueAfterAuth, deviceName, formatPhone } from '@/features/auth/flow';

/** Saisie du code SMS à 6 chiffres (autofill iOS/Android ; auto-rempli en dev). */
export default function Code() {
  const t = useTheme();
  const params = useLocalSearchParams<{ phone: string; retry?: string; devCode?: string }>();
  const phone = params.phone ?? '';
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(params.devCode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(Number(params.retry ?? 60));
  const submitting = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Dev : l'API renvoie le code hors production → on le remplit pour aller vite.
  useEffect(() => {
    if (!devCode) return;
    const id = setTimeout(() => setCode(devCode), 400);
    return () => clearTimeout(id);
  }, [devCode]);

  const verify = useCallback(
    async (value: string) => {
      if (submitting.current) return;
      submitting.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await api.auth.verifyOtp({ phone, code: value, deviceName: deviceName() });
        haptic('success');
        continueAfterAuth(result);
      } catch (e) {
        haptic('error');
        setError(errorMessage(e, 'Code incorrect. Vérifiez le SMS et réessayez.'));
        setCode('');
      } finally {
        submitting.current = false;
        setLoading(false);
      }
    },
    [phone],
  );

  const resend = async () => {
    try {
      const r = await api.auth.requestOtp({ phone });
      setCooldown(r.retryAfterSeconds ?? 60);
      setDevCode(r.devCode);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const mm = Math.floor(cooldown / 60);
  const ss = String(cooldown % 60).padStart(2, '0');

  return (
    <Screen
      footer={
        <>
          <Button label="Valider" onPress={() => verify(code)} disabled={code.length < RULES.otp.length} loading={loading} size="lg" fullWidth testID="verify-otp" />
          <Button label="Modifier le numéro" variant="ghost" onPress={() => router.back()} fullWidth />
        </>
      }
    >
      <View style={{ gap: t.spacing.xl }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title1">Saisissez le code</Text>
          <Text tone="secondary">Nous l'avons envoyé par SMS au {formatPhone(phone)}. Il est valable 5 minutes.</Text>
        </View>
        <OtpInput length={6} value={code} onChange={setCode} onComplete={verify} error={!!error} disabled={loading} testID="otp-input" />
        {error ? (
          <Text tone="danger" align="center" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {devCode ? (
          <View style={{ alignItems: 'center' }}>
            <Chip icon={FlaskConical} tone="info" label="Code de développement rempli automatiquement" />
          </View>
        ) : null}
        <Button
          variant="ghost"
          label={cooldown > 0 ? `Renvoyer le code dans ${mm}:${ss}` : 'Renvoyer le code'}
          disabled={cooldown > 0}
          onPress={resend}
        />
      </View>
    </Screen>
  );
}
