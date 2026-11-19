import { formatEuros } from '@depano/schemas';
import { Button, Card, Divider, ErrorState, Icon, ListItem, Screen, Skeleton, SkeletonList, Text, TextField, formatDateLong, haptic, useReduceMotion, useTheme, useToast } from '@depano/ui';
import { Stack } from 'expo-router';
import { Gift, PartyPopper, Share2, Ticket, UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { AuthGate } from '@/components/AuthGate';
import { errorMessage, isNetworkError } from '@/lib/api';
import { useApplyReferral, useReferral } from '../queries';
import { creditStatus, creditTitle, euros, normalizeReferralCode, referralPitch, referralShareMessage } from './referral';

/** Parrainage : code personnel (API), crédits, historique, saisie du code d'un ami. */
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
  const q = useReferral();
  const r = q.data;
  const [won, setWon] = useState<number | null>(null);

  const share = async () => {
    if (!r) return;
    const message = referralShareMessage(r.code, r.rewardRange);
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
    <Screen
      inTabs
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={<Button size="lg" fullWidth icon={Share2} label="Partager mon code" disabled={!r} onPress={() => void share()} testID="share-referral" />}
    >
      <Stack.Screen options={{ title: 'Parrainer un ami' }} />
      <View style={{ gap: t.spacing.xl, alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: t.spacing.md, paddingTop: t.spacing.lg }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.background.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon icon={Gift} size={48} color={t.colors.text.brand} />
          </View>
          <Text variant="title1" align="center">
            Parrainez, gagnez tous les deux
          </Text>
          <Text tone="secondary" align="center">
            {referralPitch(r?.rewardRange)}
          </Text>
        </View>

        {won != null ? <WonCard amountCents={won} onDismiss={() => setWon(null)} /> : null}

        <Card variant="brand" style={{ alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="label" tone="brand">
            Votre code
          </Text>
          {r ? (
            <Text variant="display" selectable testID="referral-code" accessibilityLabel={`Votre code : ${r.code.split('').join(' ')}`}>
              {r.code}
            </Text>
          ) : q.isError ? (
            <ErrorState fill={false} offline={isNetworkError(q.error)} message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
          ) : (
            <Skeleton width={200} height={40} />
          )}
          {r ? (
            <Text variant="callout" tone="secondary" align="center">
              {r.referredCount ? `${r.referredCount} ami${r.referredCount > 1 ? 's' : ''} parrainé${r.referredCount > 1 ? 's' : ''}` : 'Aucun ami parrainé pour le moment'}
            </Text>
          ) : null}
        </Card>

        {r ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {[
              { k: 'Crédits disponibles', v: formatEuros(r.availableCents) },
              { k: 'Prochaine réduction', v: r.nextDiscountCents ? formatEuros(r.nextDiscountCents) : '—' },
            ].map((s) => (
              <Card key={s.k} variant="flat" padding="md" style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={`${s.k} : ${s.v}`}>
                <Text variant="title2">{s.v}</Text>
                <Text variant="caption" tone="secondary" align="center">
                  {s.k}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}
        {r?.nextDiscountCents ? (
          <Text variant="callout" tone="secondary">
            La réduction est déduite automatiquement du total de votre prochaine intervention.
          </Text>
        ) : null}

        {r?.canApplyCode ? <ApplyCode onWon={setWon} /> : null}

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="title2" accessibilityRole="header">
            Historique
          </Text>
          {r ? (
            r.credits.length ? (
              <Card padding="none" testID="referral-history">
                {r.credits.map((c, i) => (
                  <View key={c.id}>
                    {i > 0 ? <Divider inset={56} /> : null}
                    <ListItem
                      icon={c.role === 'referrer' ? UserPlus : Ticket}
                      title={creditTitle(c)}
                      subtitle={`${formatDateLong(c.createdAt)} · ${creditStatus(c)}`}
                      value={euros(c.amountCents)}
                      chevron={false}
                    />
                  </View>
                ))}
              </Card>
            ) : (
              <Text tone="secondary">Vos réductions de parrainage apparaîtront ici.</Text>
            )
          ) : q.isPending ? (
            <SkeletonList variant="row" count={2} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

/** « Vous avez un code d'ami ? » : une seule saisie par compte, montant tiré au sort. */
function ApplyCode({ onWon }: { onWon: (amountCents: number) => void }) {
  const t = useTheme();
  const toast = useToast();
  const apply = useApplyReferral();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const v = normalizeReferralCode(code);
    if (v.length < 4) {
      setError('Saisissez le code reçu de votre ami.');
      return;
    }
    setError(null);
    apply.mutate(v, {
      onSuccess: (res) => {
        haptic('success');
        toast.success(`Bravo ! ${euros(res.amountCents)} de réduction pour vous et votre ami.`);
        onWon(res.amountCents);
        setCode('');
      },
      onError: (e) => setError(errorMessage(e, 'Ce code ne fonctionne pas. Vérifiez-le et réessayez.')),
    });
  };

  return (
    <Card variant="outline" style={{ gap: t.spacing.md }} testID="referral-apply">
      <Text variant="bodyStrong">Vous avez un code d'ami ?</Text>
      <TextField
        label="Code de parrainage"
        value={code}
        onChangeText={(v) => setCode(normalizeReferralCode(v))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Ex. : LEA42"
        error={error}
        returnKeyType="done"
        onSubmitEditing={submit}
        testID="referral-code-input"
      />
      <Button label="Valider le code" loading={apply.isPending} disabled={!code} onPress={submit} testID="referral-apply-submit" />
    </Card>
  );
}

/** Célébration du montant gagné (animation douce, désactivée si « Réduire les animations »). */
function WonCard({ amountCents, onDismiss }: { amountCents: number; onDismiss: () => void }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const scale = useSharedValue(reduce ? 1 : 0.6);
  useEffect(() => {
    scale.value = withSequence(withSpring(1.08, { reduceMotion: ReduceMotion.System }), withSpring(1, { reduceMotion: ReduceMotion.System }));
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const c = t.colors.tone.success;
  return (
    <Animated.View style={style} accessibilityLiveRegion="polite">
      <Card style={{ alignItems: 'center', gap: t.spacing.sm, backgroundColor: c.soft }} testID="referral-won">
        <Icon icon={PartyPopper} size={40} color={c.text} />
        <Text variant="title1" color={c.text} align="center">
          {euros(amountCents)} gagnés !
        </Text>
        <Text align="center">Votre ami reçoit le même montant. La réduction s'applique à votre prochaine intervention.</Text>
        <Button variant="ghost" size="sm" label="Fermer" onPress={onDismiss} />
      </Card>
    </Animated.View>
  );
}

