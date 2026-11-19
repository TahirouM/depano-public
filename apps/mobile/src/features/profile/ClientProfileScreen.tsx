import { Avatar, Button, Card, ConfirmSheet, Divider, Icon, ListItem, Screen, Skeleton, Text, useTheme, type LucideIcon } from '@depano/ui';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  Heart,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPin,
  Scale,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSwitchRole } from '@/components/RoleSwitch';
import { useIsSignedIn, useMe } from '@/lib/query/hooks';
import { signOut } from '@/lib/session';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { CLIENT_MENU, CLIENT_MENU_MORE, clientSinceLabel, takeGuestLoginPrompt, type ClientMenuEntry } from './clientMenu';

const ICONS: Record<string, LucideIcon> = {
  favoris: Heart,
  parrainage: Gift,
  compte: UserRound,
  paiement: CreditCard,
  assistance: LifeBuoy,
  legal: Scale,
  notifications: Bell,
  securite: ShieldCheck,
  adresses: MapPin,
  factures: FileText,
  parametres: Settings,
};

function Menu({ entries }: { entries: readonly ClientMenuEntry[] }) {
  return (
    <Card padding="none">
      {entries.map((e, i) => (
        <View key={e.key}>
          {i > 0 ? <Divider inset={56} /> : null}
          <ListItem title={e.title} subtitle={e.subtitle} icon={ICONS[e.key]} onPress={() => router.push(e.href)} testID={`profile-${e.key}`} />
        </View>
      ))}
    </Card>
  );
}

/**
 * Onglet Profil du client : identité (« Client depuis 2026 »), « Devenez artisan », menu, déconnexion.
 * Visiteur : la connexion s'ouvre à la première visite de l'onglet, puis une invitation reste affichée.
 */
export function ClientProfileScreen() {
  const t = useTheme();
  const signedIn = useIsSignedIn();
  const me = useMe();
  const requireAuth = useRequireAuth();
  const switchRole = useSwitchRole();
  const [confirmLogout, setConfirmLogout] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn && takeGuestLoginPrompt()) requireAuth('Connectez-vous pour accéder à votre profil.');
    }, [signedIn, requireAuth]),
  );

  if (!signedIn) {
    return (
      <Screen inTabs>
        <View style={{ gap: t.spacing.lg }} testID="profile-guest">
          <Card variant="brand" style={{ gap: t.spacing.md, alignItems: 'center', paddingVertical: t.spacing.xl }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.background.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={UserRound} size={36} color={t.colors.text.brand} />
            </View>
            <Text variant="title2" align="center">
              Votre profil DEPANO
            </Text>
            <Text tone="secondary" align="center">
              Connectez-vous pour retrouver vos rendez-vous, factures, favoris et votre code de parrainage. Un numéro, un code, c'est tout.
            </Text>
            <Button label="Se connecter ou s'inscrire" icon={LogIn} size="lg" fullWidth onPress={() => requireAuth('Connectez-vous pour accéder à votre profil.')} testID="profile-login" />
          </Card>
          <Card padding="none">
            <ListItem title="Assistance" icon={LifeBuoy} onPress={() => router.push('/profil/aide')} />
            <Divider inset={56} />
            <ListItem title="Informations légales" icon={Scale} onPress={() => router.push('/parametres/legal')} />
            <Divider inset={56} />
            <ListItem title="Paramètres" subtitle="Apparence" icon={Settings} onPress={() => router.push('/parametres')} testID="open-settings" />
          </Card>
        </View>
      </Screen>
    );
  }

  const name = [me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ');
  const hasArtisan = !!me.data?.artisan;

  return (
    <Screen inTabs>
      <View style={{ gap: t.spacing.lg }}>
        <Card variant="brand">
          {me.data ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg }}>
              <Avatar name={name || me.data.phone} uri={me.data.avatarUrl} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title2">{name || 'Mon compte'}</Text>
                <Text variant="callout" tone="secondary">
                  {clientSinceLabel(me.data.createdAt)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: t.spacing.lg, alignItems: 'center' }}>
              <Skeleton width={64} height={64} radius={32} />
              <View style={{ flex: 1, gap: t.spacing.sm }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          )}
        </Card>

        <Pressable
          onPress={() => void switchRole('artisan')}
          accessibilityRole="button"
          accessibilityLabel={hasArtisan ? 'Passer en mode artisan' : 'Devenez artisan : générez des revenus supplémentaires facilement en devenant artisan'}
          testID="switch-role"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            padding: t.spacing.lg,
            borderRadius: t.radius.md,
            borderWidth: 1.5,
            borderColor: t.colors.border.input,
            backgroundColor: t.colors.background.surface,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.background.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={BriefcaseBusiness} color={t.colors.text.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">{hasArtisan ? 'Passer en mode artisan' : 'Devenez artisan'}</Text>
            <Text variant="callout" tone="secondary">
              {hasArtisan ? 'Vos demandes, votre planning et vos revenus.' : 'Générez des revenus supplémentaires facilement en devenant artisan.'}
            </Text>
          </View>
          <Icon icon={ChevronRight} color={t.colors.text.secondary} />
        </Pressable>

        <Menu entries={CLIENT_MENU} />

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="overline" tone="secondary" accessibilityRole="header">
            Plus
          </Text>
          <Menu entries={CLIENT_MENU_MORE} />
        </View>

        <Card padding="none">
          <ListItem title="Déconnexion" icon={LogOut} chevron={false} onPress={() => setConfirmLogout(true)} testID="profile-logout" />
        </Card>
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
    </Screen>
  );
}
