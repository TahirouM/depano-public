import { Button, Text, useTheme, useToast } from '@depano/ui';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import { env, features } from '@/lib/env';
import { continueAfterAuth, deviceName } from './flow';

WebBrowser.maybeCompleteAuthSession();

/** Sign in with Apple (iOS) et Google (si configuré). */
export function SocialButtons() {
  const t = useTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (features.appleSignIn) void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);
  if (!appleAvailable && !features.googleSignIn) return null;
  return (
    <View style={{ gap: t.spacing.md }}>
      <View style={styles.sep}>
        <View style={[styles.line, { backgroundColor: t.colors.border.subtle }]} />
        <Text variant="callout" tone="secondary">
          ou
        </Text>
        <View style={[styles.line, { backgroundColor: t.colors.border.subtle }]} />
      </View>
      {appleAvailable ? <AppleButton /> : null}
      {features.googleSignIn ? <GoogleButton /> : null}
    </View>
  );
}

function AppleButton() {
  const t = useTheme();
  const toast = useToast();
  const onPress = async () => {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!cred.identityToken) throw new Error('missing token');
      const result = await api.auth.apple({
        identityToken: cred.identityToken,
        firstName: cred.fullName?.givenName ?? undefined,
        lastName: cred.fullName?.familyName ?? undefined,
        deviceName: deviceName(),
      });
      continueAfterAuth(result);
    } catch (e) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      toast.error(errorMessage(e, 'Connexion avec Apple impossible. Réessayez ou utilisez votre numéro.'));
    }
  };
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={t.scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={t.radius.md}
      style={styles.native}
      onPress={onPress}
    />
  );
}

function GoogleButton() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.google.iosClientId,
    androidClientId: env.google.androidClientId,
    webClientId: env.google.webClientId,
  });
  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) return;
    setLoading(true);
    api.auth
      .google({ idToken, deviceName: deviceName() })
      .then(continueAfterAuth)
      .catch((e) => toast.error(errorMessage(e, 'Connexion avec Google impossible.')))
      .finally(() => setLoading(false));
  }, [response, toast]);
  return (
    <Button
      label="Continuer avec Google"
      variant="secondary"
      fullWidth
      loading={loading}
      disabled={!request}
      onPress={() => void promptAsync()}
    />
  );
}

const styles = StyleSheet.create({
  sep: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1 },
  native: { height: Platform.OS === 'ios' ? 48 : 0, width: '100%' },
});
