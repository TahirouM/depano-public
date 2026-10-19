import { ConfirmSheet, ListItem, Screen, SegmentedControl, Text, useTheme, useToast } from '@depano/ui';
import { router } from 'expo-router';
import { ArrowLeftRight, Bell, LifeBuoy, LogOut, Scale, ShieldCheck, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useSwitchRole } from '@/components/RoleSwitch';
import { SettingsSection } from '@/features/settings/SettingsSection';
import { errorMessage } from '@/lib/api';
import { env } from '@/lib/env';
import { useIsSignedIn } from '@/lib/query/hooks';
import { deleteAccount, signOut } from '@/lib/session';
import { useAppStore, type SchemePreference } from '@/stores/app';

/** Paramètres : compte, sécurité, notifications, apparence, légal, aide, rôle, déconnexion, suppression. */
export default function Settings() {
  const t = useTheme();
  const toast = useToast();
  const signedIn = useIsSignedIn();
  const role = useAppStore((s) => s.activeRole);
  const scheme = useAppStore((s) => s.scheme);
  const setScheme = useAppStore((s) => s.setScheme);
  const switchRole = useSwitchRole();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteAccount();
      toast.success('Votre compte a été supprimé. Vos factures restent conservées 10 ans (obligation légale).');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: t.spacing.xl }}>
        {signedIn ? (
          <SettingsSection title="Compte">
            <ListItem title="Informations personnelles" icon={UserRound} onPress={() => router.push('/parametres/compte')} />
            <ListItem title="Sécurité" subtitle="Appareils connectés, passkeys" icon={ShieldCheck} onPress={() => router.push('/parametres/securite')} />
            <ListItem title="Notifications" icon={Bell} onPress={() => router.push('/parametres/notifications')} />
          </SettingsSection>
        ) : null}

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="overline" tone="secondary" accessibilityRole="header">
            Apparence
          </Text>
          <SegmentedControl<SchemePreference>
            accessibilityLabel="Thème de l'application"
            value={scheme}
            onChange={setScheme}
            options={[
              { value: 'system', label: 'Système' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
          />
        </View>

        <SettingsSection title="DEPANO">
          {signedIn ? (
            <ListItem
              title={role === 'artisan' ? 'Passer en mode client' : 'Passer en mode artisan'}
              icon={ArrowLeftRight}
              onPress={() => void switchRole(role === 'artisan' ? 'client' : 'artisan')}
            />
          ) : null}
          <ListItem title="Informations légales" icon={Scale} onPress={() => router.push('/parametres/legal')} />
          <ListItem title="Aide et contact" icon={LifeBuoy} onPress={() => router.push('/parametres/aide')} />
        </SettingsSection>

        {signedIn ? (
          <SettingsSection>
            <ListItem title="Se déconnecter" icon={LogOut} onPress={() => setConfirmLogout(true)} chevron={false} />
            <ListItem title="Supprimer mon compte" icon={Trash2} destructive onPress={() => setConfirmDelete(true)} chevron={false} testID="delete-account" />
          </SettingsSection>
        ) : null}

        <Text variant="caption" tone="secondary" align="center">
          DEPANO · version {env.appVersion}
        </Text>
      </View>

      <ConfirmSheet
        visible={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          void signOut();
        }}
        title="Se déconnecter ?"
        message="Vos brouillons et messages en attente sur cet appareil seront effacés."
        confirmLabel="Se déconnecter"
      />
      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={busy}
        tone="danger"
        title="Supprimer définitivement votre compte ?"
        message="Vos données personnelles seront anonymisées. Les factures sont conservées 10 ans (obligation comptable). Cette action est irréversible."
        confirmLabel="Supprimer mon compte"
      />
    </Screen>
  );
}
