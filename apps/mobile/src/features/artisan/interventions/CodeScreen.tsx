import {
  ApiError,
  formatEuros,
  RULES,
  type ArtisanDashboardDto,
  type BookingDetailDto,
} from '@depano/schemas';
import {
  Button,
  Card,
  haptic,
  OtpInput,
  PriceRow,
  Screen,
  SkeletonText,
  Text,
  useTheme,
} from '@depano/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { CircleCheck, KeyRound, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { QueryView } from '@/components/QueryView';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useBookingLive } from '@/lib/realtime/hooks';
import { setBookingDetail } from '../queries';

/** Saisie du code de fin (4 chiffres, 3 essais) → capture du paiement, carte suivante. */
export function CodeScreen({ id }: { id: string }) {
  const q = useBookingLive(id);
  return (
    <>
      <Stack.Screen options={{ title: 'Code de fin' }} />
      <QueryView query={q} loading={<SkeletonText lines={4} />}>
        {(b) => <CodeForm b={b} />}
      </QueryView>
    </>
  );
}

function CodeForm({ b }: { b: BookingDetailDto }) {
  const t = useTheme();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(b.completionAttemptsLeft);
  const [locked, setLocked] = useState(b.completionAttemptsLeft <= 0);

  const complete = useMutation({
    mutationFn: (c: string) => api.bookings.complete(b.id, { code: c }),
    onSuccess: (nb) => {
      haptic('success');
      setBookingDetail(qc, nb);
      void qc.invalidateQueries({ queryKey: qk.artisan.earnings });
      void qc.invalidateQueries({ queryKey: qk.artisan.stats });
    },
    onError: (e) => {
      haptic('error');
      setCode('');
      const d =
        e instanceof ApiError ? (e.details as { attemptsLeft?: number } | undefined) : undefined;
      if (e instanceof ApiError && (e.status === 423 || e.code === 'code_locked')) {
        setLocked(true);
        setLeft(0);
      } else if (d?.attemptsLeft != null) setLeft(d.attemptsLeft);
      setError(errorMessage(e));
    },
  });

  if (b.status === 'closed') return <Success b={b} />;

  if (locked) {
    return (
      <Screen
        inTabs
        footer={
          <Button
            label="Contacter le support"
            size="lg"
            fullWidth
            onPress={() => router.push('/pro/profil/aide')}
          />
        }
      >
        <View
          style={{ alignItems: 'center', gap: t.spacing.md, paddingTop: t.spacing.xxl }}
          testID="code-locked"
        >
          <Lock size={56} color={t.colors.tone.danger.solid} />
          <Text variant="title1" align="center" accessibilityRole="header">
            Code bloqué
          </Text>
          <Text tone="secondary" align="center">
            {RULES.completionCode.maxAttempts} codes incorrects. Le support DEPANO a été alerté et
            va vous contacter. Sans contestation du client, le paiement est capturé automatiquement
            sous {RULES.completionCode.autoCaptureAfterHours} h.
          </Text>
        </View>
      </Screen>
    );
  }

  if (b.status !== 'awaiting_code') {
    return (
      <Screen
        inTabs
        footer={
          <Button
            label="Retour à l'intervention"
            size="lg"
            variant="secondary"
            fullWidth
            onPress={() => router.back()}
          />
        }
      >
        <Text tone="secondary">Le code de fin se saisit après l'envoi du compte rendu.</Text>
      </Screen>
    );
  }

  return (
    <Screen inTabs testID="code-screen">
      <View style={{ gap: t.spacing.xl, alignItems: 'center', paddingTop: t.spacing.xl }}>
        <KeyRound size={48} color={t.colors.text.brand} />
        <View style={{ gap: t.spacing.xs }}>
          <Text variant="title1" align="center" accessibilityRole="header">
            Code de fin
          </Text>
          <Text tone="secondary" align="center">
            Demandez à {b.client?.firstName ?? 'votre client'} le code à 4 chiffres affiché dans son
            application.
          </Text>
        </View>
        <OtpInput
          length={4}
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={(c) => complete.mutate(c)}
          error={!!error}
          autoFocus
          disabled={complete.isPending}
          label="Code de fin d'intervention"
          testID="completion-code"
        />
        {error ? (
          <Text
            tone="danger"
            align="center"
            accessibilityLiveRegion="assertive"
            testID="code-error"
          >
            {error}
          </Text>
        ) : null}
        <Text variant="callout" tone={left <= 1 ? 'danger' : 'secondary'} testID="code-attempts">
          {left} essai{left > 1 ? 's' : ''} restant{left > 1 ? 's' : ''}
        </Text>
        {complete.isPending ? (
          <Text variant="callout" tone="secondary">
            Vérification…
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Success({ b }: { b: BookingDetailDto }) {
  const t = useTheme();
  const qc = useQueryClient();
  const next = () => {
    const dash = qc.getQueryData<ArtisanDashboardDto>(qk.artisan.dashboard);
    const n =
      dash?.next && dash.next.id !== b.id ? dash.next : dash?.upcoming.find((x) => x.id !== b.id);
    if (n) router.replace({ pathname: '/pro/interventions/[id]', params: { id: n.id } });
    else router.replace('/pro/accueil');
  };
  const net = (b.capturedCents ?? 0) - (b.commissionCents ?? 0);
  return (
    <Screen
      inTabs
      footer={
        <Button label="Carte suivante" size="lg" fullWidth onPress={next} testID="next-card" />
      }
    >
      <View
        style={{ gap: t.spacing.lg, alignItems: 'center', paddingTop: t.spacing.xl }}
        testID="code-success"
      >
        <CircleCheck size={72} color={t.colors.tone.success.solid} />
        <Text
          variant="title1"
          align="center"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          Intervention clôturée
        </Text>
        <Text tone="secondary" align="center">
          Paiement capturé. Le virement arrive sous 2 à 3 jours ouvrés.
        </Text>
        <Card variant="brand" style={{ alignSelf: 'stretch', gap: t.spacing.sm }}>
          <PriceRow label="Encaissé" cents={b.capturedCents ?? 0} />
          <PriceRow label="Commission DEPANO" cents={-(b.commissionCents ?? 0)} />
          <PriceRow label="Net pour vous" cents={net} total />
        </Card>
        <Text variant="caption" tone="secondary">
          Le client peut maintenant vous noter. {formatEuros(net)} ajoutés à vos revenus.
        </Text>
      </View>
    </Screen>
  );
}
