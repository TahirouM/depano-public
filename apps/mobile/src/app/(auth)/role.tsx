import { Card, Icon, Screen, Text, haptic, useTheme, type LucideIcon } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Briefcase, ChevronRight, House } from 'lucide-react-native';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { features } from '@/lib/env';
import { qk } from '@/lib/query/keys';
import { finishAuthFlow } from '@/lib/session';
import { useAppStore, type ActiveRole } from '@/stores/app';

/** Choix du rôle : « J'ai besoin d'un artisan » / « Je suis artisan ». */
export default function Role() {
  const t = useTheme();
  const qc = useQueryClient();
  const setRole = useAppStore((s) => s.setActiveRole);

  const choose = (role: ActiveRole) => {
    haptic('selection');
    setRole(role);
    api.me
      .setActiveRole({ role })
      .then((me) => qc.setQueryData(qk.me, me))
      .catch(() => undefined); // le serveur peut créer le profil artisan plus tard (KYC)
    if (role === 'artisan') router.replace({ pathname: '/autorisations', params: { suite: 'pro' } });
    else finishAuthFlow('/accueil');
  };

  return (
    <Screen>
      <View style={{ gap: t.spacing.lg }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title1">Bienvenue sur DEPANO</Text>
          <Text tone="secondary">Vous pourrez changer d'espace à tout moment depuis votre profil.</Text>
        </View>
        <RoleCard
          icon={House}
          title="J'ai besoin d'un artisan"
          body={features.urgent ? 'Urgence ou rendez-vous, avec le prix affiché avant de vous engager.' : 'Prenez rendez-vous avec un artisan vérifié, avec le prix affiché avant de vous engager.'}
          onPress={() => choose('client')}
        />
        <RoleCard
          icon={Briefcase}
          title="Je suis artisan"
          body="Recevez des demandes près de chez vous, soyez payé sans relance."
          onPress={() => choose('artisan')}
        />
      </View>
    </Screen>
  );
}

function RoleCard({ icon, title, body, onPress }: { icon: LucideIcon; title: string; body: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card variant="brand" onPress={onPress} accessibilityLabel={`${title}. ${body}`} padding="xl">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.lg }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.background.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon icon={icon} size={28} color={t.colors.text.brand} />
        </View>
        <View style={{ flex: 1, gap: t.spacing.xs }}>
          <Text variant="title2">{title}</Text>
          <Text tone="secondary">{body}</Text>
        </View>
        <Icon icon={ChevronRight} color={t.colors.text.secondary} />
      </View>
    </Card>
  );
}
