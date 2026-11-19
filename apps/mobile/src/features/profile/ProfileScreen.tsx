import { ARTISAN_STATUSES } from '@depano/schemas';
import { Avatar, Badge, Button, Card, Divider, ListItem, Screen, Skeleton, Text, useTheme, type LucideIcon } from '@depano/ui';
import { router, type Href } from 'expo-router';
import {
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  CreditCard,
  Eye,
  FileText,
  Gift,
  Heart,
  History,
  LifeBuoy,
  MapPin,
  Settings,
  Tag,
  Wallet,
} from 'lucide-react-native';
import { View } from 'react-native';
import { useSwitchRole } from '@/components/RoleSwitch';
import { formatPhone } from '@/features/auth/flow';
import { useIsSignedIn, useMe } from '@/lib/query/hooks';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { ClientProfileScreen } from './ClientProfileScreen';

interface Row {
  title: string;
  icon: LucideIcon;
  href: Href;
  subtitle?: string;
}

const CLIENT_ROWS: Row[] = [
  { title: 'Adresses', icon: MapPin, href: '/profil/adresses' },
  { title: 'Moyens de paiement', icon: CreditCard, href: '/profil/paiement' },
  { title: 'Factures', icon: FileText, href: '/profil/factures' },
  { title: 'Favoris', icon: Heart, href: '/profil/favoris' },
  { title: 'Parrainage', icon: Gift, href: '/profil/parrainage' },
  { title: 'Aide', icon: LifeBuoy, href: '/profil/aide' },
];

const ARTISAN_ROWS: Row[] = [
  { title: 'Profil public', subtitle: 'Aperçu « vu client »', icon: Eye, href: '/pro/profil/apercu' },
  { title: 'Disponibilités', icon: CalendarClock, href: '/pro/profil/disponibilites' },
  { title: 'Tarifs', icon: Tag, href: '/pro/profil/tarifs' },
  { title: 'Revenus', icon: Wallet, href: '/pro/profil/revenus' },
  { title: 'Statistiques', icon: BarChart3, href: '/pro/profil/statistiques' },
  { title: 'Activité', subtitle: 'Réservations, annulations, avis', icon: History, href: '/pro/profil/activite' },
  { title: 'Aide', icon: LifeBuoy, href: '/pro/profil/aide' },
];

const ARTISAN_STATUS_LABEL: Record<(typeof ARTISAN_STATUSES)[number], string> = {
  draft: 'Inscription à compléter',
  pending_review: 'En vérification (48 h ouvrées)',
  approved: 'Profil vérifié',
  rejected: 'Dossier refusé',
  suspended: 'Compte suspendu',
};

/** Onglet Profil (client ou artisan) : identité, raccourcis, changement d'espace, paramètres. */
export function ProfileScreen({ as }: { as: 'client' | 'artisan' }) {
  if (as === 'client') return <ClientProfileScreen />;
  return <SpaceProfileScreen as={as} />;
}

function SpaceProfileScreen({ as }: { as: 'client' | 'artisan' }) {
  const t = useTheme();
  const signedIn = useIsSignedIn();
  const me = useMe();
  const requireAuth = useRequireAuth();
  const switchRole = useSwitchRole();
  const rows = as === 'client' ? CLIENT_ROWS : ARTISAN_ROWS;
  const name = [me.data?.firstName, me.data?.lastName].filter(Boolean).join(' ');
  const artisan = me.data?.artisan;

  const switchLabel =
    as === 'artisan' ? 'Passer en mode client' : artisan ? 'Passer en mode artisan' : 'Devenir artisan';
  const onSwitch = () => {
    if (as === 'client' && !requireAuth('Connectez-vous pour créer votre espace artisan.')) return;
    void switchRole(as === 'client' ? 'artisan' : 'client');
  };

  return (
    <Screen inTabs>
      <View style={{ gap: t.spacing.lg }}>
        {signedIn ? (
          <Card variant="brand">
            {me.data ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg }}>
                <Avatar name={name || me.data.phone} uri={me.data.avatarUrl} size={64} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title2">{name || 'Mon compte'}</Text>
                  {me.data.phone ? (
                    <Text variant="callout" tone="secondary">
                      {formatPhone(me.data.phone)}
                    </Text>
                  ) : null}
                  {as === 'artisan' && artisan ? (
                    <Badge label={ARTISAN_STATUS_LABEL[artisan.status]} tone={artisan.status === 'approved' ? 'success' : artisan.status === 'pending_review' ? 'warning' : 'neutral'} />
                  ) : null}
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
        ) : (
          <Card variant="brand" style={{ gap: t.spacing.md }}>
            <Text variant="title2">Bienvenue</Text>
            <Text tone="secondary">Créez votre compte au moment de réserver : un numéro, un code, c'est tout.</Text>
            <Button label="Se connecter ou s'inscrire" onPress={() => requireAuth()} fullWidth />
          </Card>
        )}

        {signedIn ? (
          <Card padding="none">
            {rows.map((r, i) => (
              <View key={r.title}>
                {i > 0 ? <Divider inset={56} /> : null}
                <ListItem title={r.title} subtitle={r.subtitle} icon={r.icon} onPress={() => router.push(r.href)} />
              </View>
            ))}
          </Card>
        ) : null}

        <Card padding="none">
          <ListItem
            title={switchLabel}
            subtitle={as === 'artisan' ? 'Réserver un artisan pour vous' : 'Recevez des demandes près de chez vous'}
            icon={ArrowLeftRight}
            onPress={onSwitch}
            testID="switch-role"
          />
          <Divider inset={56} />
          <ListItem title="Paramètres" icon={Settings} onPress={() => router.push('/parametres')} testID="open-settings" />
        </Card>
      </View>
    </Screen>
  );
}
