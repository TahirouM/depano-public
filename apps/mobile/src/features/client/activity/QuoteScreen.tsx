import { formatEuros, type QuoteLineDto } from '@depano/schemas';
import { Button, Card, ConfirmSheet, Divider, EmptyState, ErrorState, Icon, PriceRow, Screen, Skeleton, SkeletonText, Text, formatTime, useTheme, useToast } from '@depano/ui';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { CircleCheck, Clock, FileText, FileX, Info, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { api, ApiError, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { useBookingLive } from '@/lib/realtime/hooks';
import { sessionToSheet } from '../payment/useCheckout';
import { usePaymentSheet } from '../payment/usePaymentSheet';

const KIND_LABEL: Record<QuoteLineDto['kind'], string> = { labor: "Main-d'œuvre", part: 'Pièces', travel: 'Déplacement' };

/** Minutes restantes avant l'expiration du devis (mise à jour chaque seconde… sans excès). */
function useMinutesLeft(expiresAt: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60_000));
}

/** Validation du devis : lignes, total TTC, accepter / refuser ; expiré ; autorisation complémentaire. */
export function QuoteScreen({ id }: { id: string }) {
  return (
    <AuthGate title="Devis" message="Connectez-vous pour consulter le devis.">
      <QuoteInner id={id} />
    </AuthGate>
  );
}

function QuoteInner({ id }: { id: string }) {
  const t = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const sheet = usePaymentSheet();
  const live = useBookingLive(id);
  const b = live.data;
  const quote = b?.quote ?? null;
  const left = useMinutesLeft(quote?.expiresAt);
  const [busy, setBusy] = useState<'accept' | 'refuse' | null>(null);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [goneError, setGoneError] = useState(false);

  const answer = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'refuse');
    try {
      const res = await api.bookings.answerQuote(id, { accept });
      if (res.payment) {
        // Dépassement de plus de 20 % : autorisation complémentaire à valider.
        const r = await sheet.present(sessionToSheet(res.payment));
        if (r.status !== 'succeeded') toast.error(r.status === 'failed' ? r.message : 'Autorisation complémentaire non validée : l’artisan ne peut pas commencer.');
      }
      qc.setQueryData(qk.bookings.detail(id), res.booking);
      void qc.invalidateQueries({ queryKey: qk.bookings.lists });
      void qc.invalidateQueries({ queryKey: qk.badges });
      if (accept) toast.success("Devis validé. L'artisan peut commencer.");
      else toast.show("Devis refusé. L'artisan peut vous en proposer un autre.");
      setRefuseOpen(false);
      router.dismissTo({ pathname: '/activite/[id]', params: { id } });
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'quote_expired' || e.status === 410)) setGoneError(true);
      toast.error(errorMessage(e));
      void live.refetch();
    } finally {
      setBusy(null);
    }
  };

  const header = <Stack.Screen options={{ title: 'Devis' }} />;
  if (!b) {
    return (
      <Screen inTabs>
        {header}
        {live.isError ? (
          <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refetch()} />
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            <Skeleton width="60%" height={28} />
            <SkeletonText lines={6} />
          </View>
        )}
      </Screen>
    );
  }

  if (!quote) {
    return (
      <Screen inTabs>
        {header}
        <EmptyState fill icon={FileText} title="Pas encore de devis" message="L'artisan vous enverra un devis détaillé sur place, avant tout travail." action={{ label: "Retour à l'intervention", onPress: () => router.dismissTo({ pathname: '/activite/[id]', params: { id } }) }} />
      </Screen>
    );
  }

  const expired = goneError || quote.status === 'expired' || (quote.status === 'sent' && left === 0);
  const answerable = quote.status === 'sent' && !expired && b.status === 'quote_pending';
  const byKind = (['labor', 'part', 'travel'] as const).map((k) => ({ k, lines: quote.lines.filter((l) => l.kind === k) })).filter((g) => g.lines.length);
  const authorized = b.authorizedCents;

  return (
    <Screen
      inTabs
      footer={
        answerable ? (
          <View style={{ gap: t.spacing.sm }}>
            <Button size="lg" fullWidth label={`Valider le devis · ${formatEuros(quote.totalCents)}`} loading={busy === 'accept'} disabled={!!busy} onPress={() => void answer(true)} haptic="success" testID="accept-quote" />
            <Button variant="ghost" fullWidth label="Refuser" disabled={!!busy} onPress={() => setRefuseOpen(true)} testID="refuse-quote" />
          </View>
        ) : undefined
      }
    >
      {header}
      <View style={{ gap: t.spacing.xl }} testID="quote">
        <View style={{ gap: t.spacing.xs }}>
          <Text variant="title1">Devis de {b.artisan?.displayName ?? "l'artisan"}</Text>
          <Text tone="secondary">{b.serviceName ?? b.problemReason}</Text>
        </View>

        {expired ? (
          <Card variant="outline" style={{ flexDirection: 'row', gap: t.spacing.md }} testID="quote-expired">
            <Icon icon={FileX} color={t.colors.tone.warning.text} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Devis expiré</Text>
              <Text variant="callout" tone="secondary">
                Il n'a pas été validé dans les 30 minutes. Demandez à l'artisan de vous le renvoyer.
              </Text>
            </View>
          </Card>
        ) : quote.status === 'accepted' ? (
          <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <Icon icon={CircleCheck} color={t.colors.tone.success.text} />
            <Text style={{ flex: 1 }}>Devis validé{quote.answeredAt ? ` à ${formatTime(quote.answeredAt)}` : ''}.</Text>
          </Card>
        ) : quote.status === 'refused' ? (
          <Card variant="flat" style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <Icon icon={FileX} color={t.colors.text.secondary} />
            <Text style={{ flex: 1 }}>Vous avez refusé ce devis.</Text>
          </Card>
        ) : left != null ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }} accessibilityLiveRegion="polite">
            <Icon icon={Clock} size={20} color={t.colors.tone.warning.text} />
            <Text variant="callout" tone="warning">
              Valable encore {left} min
            </Text>
          </View>
        ) : null}

        <Card style={{ gap: t.spacing.lg }}>
          {byKind.map((g) => (
            <View key={g.k} style={{ gap: t.spacing.sm }}>
              <Text variant="overline" tone="secondary">
                {KIND_LABEL[g.k]}
              </Text>
              {g.lines.map((l) => (
                <PriceRow
                  key={l.id}
                  label={l.quantity !== 1 ? `${l.label} (${String(l.quantity).replace('.', ',')} × ${formatEuros(l.unitPriceCents)})` : l.label}
                  cents={l.totalCents}
                />
              ))}
            </View>
          ))}
          <Divider />
          <PriceRow label="Total TTC" cents={quote.totalCents} total />
        </Card>

        {quote.needsNewAuthorization ? (
          <Card variant="outline" style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <Icon icon={TriangleAlert} color={t.colors.tone.warning.text} />
            <Text variant="callout" style={{ flex: 1 }}>
              Ce devis dépasse de plus de 20 % le montant autorisé ({formatEuros(authorized)}). En le validant, vous autorisez le complément de {formatEuros(Math.max(0, quote.totalCents - authorized))} sur votre carte. Rien n'est débité avant le code de fin.
            </Text>
          </Card>
        ) : (
          <Text variant="callout" tone="secondary">
            Dans la fourchette annoncée. Rien n'est débité avant le code de fin.
          </Text>
        )}
        {quote.keepReplacedParts ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Icon icon={Info} size={20} color={t.colors.text.secondary} />
            <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
              Les pièces remplacées vous sont laissées : vous pouvez les conserver.
            </Text>
          </View>
        ) : null}
      </View>
      <ConfirmSheet
        visible={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        onConfirm={() => void answer(false)}
        loading={busy === 'refuse'}
        title="Refuser ce devis ?"
        message="L'artisan ne commencera pas les travaux. Il peut vous proposer un nouveau devis ; seuls les frais de déplacement restent dus si vous en restez là."
        confirmLabel="Refuser le devis"
        cancelLabel="Revenir au devis"
        tone="danger"
      />
    </Screen>
  );
}
