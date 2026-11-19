import type { ArtisanStatus } from '@depano/schemas';
import { Button, Card, Text, useTheme } from '@depano/ui';
import { router } from 'expo-router';
import { CircleAlert, Hourglass, ShieldAlert, UserPen } from 'lucide-react-native';
import { View } from 'react-native';
import { features } from '@/lib/env';

const COPY: Record<
  Exclude<ArtisanStatus, 'approved'>,
  {
    title: string;
    body: string;
    cta: string;
    href: '/pro/onboarding' | '/pro/onboarding/verification';
  }
> = {
  draft: {
    title: 'Complétez votre inscription',
    body: 'Votre compte n’est pas encore validé : vous ne recevez pas de demandes. Terminez les 5 étapes pour être vérifié.',
    cta: 'Compléter mon inscription',
    href: '/pro/onboarding',
  },
  pending_review: {
    title: 'Compte en vérification',
    body: features.urgent
      ? 'Un conseiller vérifie votre dossier sous 48 h ouvrées. Les urgences seront débloquées dès la validation.'
      : 'Un conseiller vérifie votre dossier sous 48 h ouvrées. Vous recevrez des demandes de rendez-vous dès la validation.',
    cta: 'Voir l’avancement',
    href: '/pro/onboarding/verification',
  },
  rejected: {
    title: 'Dossier refusé',
    body: 'Certains éléments doivent être corrigés avant la validation de votre compte.',
    cta: 'Corriger mon dossier',
    href: '/pro/onboarding',
  },
  suspended: {
    title: 'Compte suspendu',
    body: 'Vous ne recevez plus de nouvelles demandes. Votre historique et vos revenus restent consultables.',
    cta: 'Contacter le support',
    href: '/pro/onboarding/verification',
  },
};

/** État « compte non validé » de l'accueil artisan. */
export function AccountStatusCard({
  status,
  reason,
}: {
  status: Exclude<ArtisanStatus, 'approved'>;
  reason?: string | null;
}) {
  const t = useTheme();
  const c = COPY[status];
  const Icon =
    status === 'draft'
      ? UserPen
      : status === 'pending_review'
        ? Hourglass
        : status === 'rejected'
          ? CircleAlert
          : ShieldAlert;
  const tone =
    status === 'pending_review'
      ? t.colors.tone.warning
      : status === 'draft'
        ? t.colors.tone.brand
        : t.colors.tone.danger;
  return (
    <Card
      variant="outline"
      style={{ gap: t.spacing.md, borderColor: tone.solid }}
      testID={`account-status-${status}`}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
        <Icon size={24} color={tone.text} />
        <Text variant="title2" style={{ flex: 1 }}>
          {c.title}
        </Text>
      </View>
      <Text tone="secondary">{status === 'rejected' && reason ? reason : c.body}</Text>
      <Button
        label={c.cta}
        size="lg"
        fullWidth
        onPress={() =>
          status === 'suspended' ? router.push('/pro/profil/aide') : router.push(c.href)
        }
        testID="account-status-cta"
      />
    </Card>
  );
}
