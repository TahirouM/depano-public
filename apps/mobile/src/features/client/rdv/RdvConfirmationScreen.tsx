import { DOMAIN_LABELS, RULES, formatEuros } from '@depano/schemas';
import { Button, Card, ErrorState, Icon, Screen, Skeleton, SuccessCheck, Text, formatDateTime, useReduceMotion, useTheme, useToast } from '@depano/ui';
import { router, Stack } from 'expo-router';
import { Bell, CalendarPlus, Hourglass, KeyRound, MessageCircle, ReceiptEuro, Send } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { errorMessage } from '@/lib/api';
import { askPermission } from '@/lib/permissions';
import { useBooking } from '@/lib/query/hooks';
import { useAppStore } from '@/stores/app';
import { addressLabel } from '../drafts';
import { addToCalendar } from '../calendar/addToCalendar';
import { useLeaveFlow } from '../navigation';
import { PRICE_ON_REQUEST_LABEL } from './useRdv';

/**
 * Après l'envoi de la demande de RDV : l'artisan doit l'accepter (statut `requested`), ou chiffrer
 * un besoin « Autre… » (prix proposé, à accepter par le client). Animation, calendrier, prochaines étapes.
 */
export function RdvConfirmationScreen({ bookingId }: { bookingId: string }) {
  const t = useTheme();
  const leaveFlowTo = useLeaveFlow();
  const toast = useToast();
  const q = useBooking(bookingId);
  const b = q.data;
  const reduce = useReduceMotion();
  const scale = useSharedValue(reduce ? 1 : 0.3);
  const [adding, setAdding] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, reduceMotion: ReduceMotion.System });
  }, [scale]);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onRequest = !!b?.priceOnRequest && !b.artisanAccepted;
  const confirmed = b?.status === 'accepted';
  const who = b?.artisan?.displayName ?? "L'artisan";
  const steps = onRequest
    ? [
        { icon: ReceiptEuro, text: "L'artisan va étudier votre demande et vous proposer un prix ; vous pourrez l'accepter ou non." },
        { icon: Bell, text: 'Vous êtes prévenu dès sa réponse. Rien n’est payé avant votre accord.' },
        { icon: MessageCircle, text: 'La messagerie avec l’artisan s’ouvre dès qu’il a répondu.' },
      ]
    : confirmed
      ? [
          { icon: Bell, text: 'Rappel la veille et 1 h avant le rendez-vous.' },
          { icon: MessageCircle, text: "Une question ? Écrivez à l'artisan depuis l'intervention." },
          { icon: KeyRound, text: "À la fin, donnez votre code à 4 chiffres : c'est seulement là que vous êtes débité." },
        ]
      : [
          { icon: Hourglass, text: `${who} doit accepter votre demande (sous ${RULES.requestTtlHours} h au plus tard). Vous êtes prévenu dès sa réponse.` },
          { icon: MessageCircle, text: 'La messagerie avec l’artisan s’ouvre dès qu’il accepte.' },
          { icon: KeyRound, text: "Votre carte n'est débitée qu'à la fin, quand vous donnez votre code à 4 chiffres." },
        ];

  useEffect(() => {
    if (asked.current || Platform.OS === 'web' || useAppStore.getState().permissionAsked.notifications) return;
    asked.current = true;
    const id = setTimeout(() => void askPermission('notifications', 'Pour recevoir le rappel la veille et 1 h avant'), 1500);
    return () => clearTimeout(id);
  }, []);

  const onCalendar = async () => {
    if (!b?.scheduledAt) return;
    setAdding(true);
    const start = new Date(b.scheduledAt);
    const r = await addToCalendar({
      title: `DEPANO · ${b.serviceName ?? b.problemReason}${b.artisan ? ` avec ${b.artisan.displayName}` : ''}`,
      start,
      end: new Date(start.getTime() + 60 * 60_000),
      location: addressLabel(b.address),
      notes: `Réf. ${b.reference}. Code de fin dans l'app DEPANO, à donner à la fin uniquement.`,
    });
    setAdding(false);
    if (r === 'saved') toast.success('Ajouté à votre calendrier.');
    else if (r === 'unavailable') toast.error("Impossible d'accéder au calendrier.");
  };

  return (
    <Screen
      footer={
        <View style={{ gap: t.spacing.sm }}>
          <Button size="lg" fullWidth label={onRequest ? 'Voir ma demande' : 'Voir mon rendez-vous'} onPress={() => leaveFlowTo({ pathname: '/activite/[id]', params: { id: bookingId } })} testID="confirmation-open" />
          <Button variant="ghost" fullWidth label="Retour à l'accueil" onPress={() => leaveFlowTo('/accueil')} />
        </View>
      }
    >
      <Stack.Screen options={{ title: confirmed ? 'Confirmation' : 'Demande envoyée', headerShown: true, headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
      <View style={{ gap: t.spacing.xl, alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: t.spacing.md, paddingTop: t.spacing.lg }}>
          {confirmed ? (
            // RDV confirmé : coche animée. Pas d'haptique ici, useCheckout vient déjà de déclencher « success ».
            <SuccessCheck size={96} haptic={false} accessibilityLabel="Rendez-vous confirmé" testID="confirmation-check" />
          ) : (
            <Animated.View
              style={[{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.tone.success.solid, alignItems: 'center', justifyContent: 'center' }, badge]}
            >
              <Icon icon={Send} size={44} color={t.colors.tone.success.onSolid} strokeWidth={2.5} />
            </Animated.View>
          )}
          <Text variant="title1" align="center" accessibilityLiveRegion="polite">
            {confirmed ? 'Rendez-vous confirmé' : 'Demande envoyée'}
          </Text>
          {b && !confirmed ? (
            <Text tone="secondary" align="center">
              {onRequest
                ? "L'artisan va étudier votre demande et vous proposer un prix ; vous pourrez l'accepter ou non."
                : `${who} doit maintenant accepter le rendez-vous.`}
            </Text>
          ) : null}
        </View>

        {b ? (
          <Card style={{ gap: t.spacing.sm }} testID="confirmation-summary">
            <Text variant="title2">{b.scheduledAt ? formatDateTime(b.scheduledAt) : '—'}</Text>
            <Text>
              {DOMAIN_LABELS[b.domain]} · {b.serviceName ?? b.problemReason}
            </Text>
            {b.artisan ? <Text tone="secondary">Avec {b.artisan.displayName}</Text> : null}
            <Text tone="secondary">{addressLabel(b.address)}</Text>
            <Text variant="bodyStrong">{onRequest ? PRICE_ON_REQUEST_LABEL : `Total TTC : ${formatEuros(b.totalCents)}`}</Text>
            <Text variant="caption" tone="secondary">
              Réf. {b.reference}
            </Text>
          </Card>
        ) : q.isError ? (
          <ErrorState fill={false} message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <Skeleton height={160} radius={t.radius.md} />
        )}

        <Button variant="secondary" size="lg" fullWidth icon={CalendarPlus} label="Ajouter au calendrier" loading={adding} disabled={!b?.scheduledAt} onPress={() => void onCalendar()} testID="add-calendar" />

        <View style={{ gap: t.spacing.md }}>
          <Text variant="title2" accessibilityRole="header">
            Prochaines étapes
          </Text>
          {steps.map((s) => (
            <View key={s.text} style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
              <Icon icon={s.icon} color={t.colors.text.brand} />
              <Text style={{ flex: 1 }}>{s.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
