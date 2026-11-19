import { DOMAIN_LABELS, NOT_FEASIBLE_REASON_LABELS, formatEuros, type BookingDetailDto } from '@depano/schemas';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  DOMAIN_ICONS,
  Divider,
  EmptyState,
  ErrorState,
  Icon,
  IconCircle,
  Screen,
  Skeleton,
  SkeletonText,
  StarRating,
  Text,
  useTheme,
  useToast,
  type LucideIcon,
} from '@depano/ui';
import { router, Stack } from 'expo-router';
import { CalendarCheck, CalendarClock, ChevronRight, ClipboardList, FileText, MessageSquareText, Receipt, ShieldCheck, Star, TriangleAlert, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { errorMessage } from '@/lib/api';
import { useBooking } from '@/lib/query/hooks';
import { openDocument } from '../openFile';
import { useArtisan, useInvoices } from '../queries';
import { doneAt, finalAmountCents, formatDoneAt } from './bookingState';
import { NOT_FEASIBLE_LABEL } from './timeline';

/** Intervention réalisée (onglet Interventions) : artisan, date, notation, détail, total, compte rendu, facture. */
export function CompletedInterventionScreen({ id }: { id: string }) {
  return (
    <AuthGate title="Intervention" message="Connectez-vous pour retrouver cette intervention.">
      <Inner id={id} />
    </AuthGate>
  );
}

function DetailRow({ icon, label }: { icon: LucideIcon; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center', minHeight: 32 }}>
      <Icon icon={icon} size={20} color={t.colors.text.primary} strokeWidth={1.75} />
      <Text style={{ flex: 1 }}>{label}</Text>
    </View>
  );
}

function Inner({ id }: { id: string }) {
  const t = useTheme();
  const toast = useToast();
  const q = useBooking(id);
  const b = q.data;
  const artisan = useArtisan(b?.artisan?.id);
  const invoices = useInvoices();
  const [reportOpen, setReportOpen] = useState(false);

  if (!b) {
    return (
      <Screen inTabs>
        <Stack.Screen options={{ title: 'Intervention réalisée' }} />
        {q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            <Skeleton height={120} radius={t.radius.md} />
            <Skeleton height={80} radius={t.radius.md} />
            <SkeletonText lines={5} />
          </View>
        )}
      </Screen>
    );
  }

  const cancelled = b.status === 'cancelled_by_client' || b.status === 'cancelled_by_artisan';
  const invoice = b.invoiceId ? invoices.data?.find((i) => i.id === b.invoiceId) : invoices.data?.find((i) => i.bookingId === b.id && i.kind === 'service');
  const total = finalAmountCents(b);
  const hasReport = !!b.report || !!b.notFeasible;
  // Intervention terminée : le bouton est toujours proposé, la feuille indique si le compte rendu manque.
  const finished = b.status === 'closed' || b.status === 'disputed';
  const showReport = hasReport || finished;

  const openInvoice = async () => {
    const fresh = (await invoices.refetch()).data?.find((i) => i.id === invoice?.id) ?? invoice;
    if (!fresh?.pdfUrl) {
      toast.show('La facture est en cours de génération. Réessayez dans un instant.');
      return;
    }
    await openDocument(fresh.pdfUrl);
  };

  return (
    <Screen inTabs refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: cancelled ? 'Intervention annulée' : 'Intervention réalisée' }} />
      <View style={{ gap: t.spacing.lg }} testID="completed-intervention">
        {b.artisan ? (
          <Card style={{ flexDirection: 'row', gap: t.spacing.lg, alignItems: 'center' }}>
            <Avatar name={b.artisan.displayName} uri={b.artisan.avatarUrl} size={96} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="title2">{b.artisan.displayName}</Text>
              <Text tone="secondary">{DOMAIN_LABELS[b.domain]}</Text>
              <StarRating value={artisan.data?.ratingAvg ?? b.artisan.ratingAvg} count={artisan.data?.ratingCount} />
              <View style={{ flexDirection: 'row' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={UserRound}
                  label="Voir profil"
                  onPress={() => router.push({ pathname: '/artisan/[id]', params: { id: b.artisan!.id } })}
                  testID="completed-artisan-profile"
                />
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: t.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <Icon icon={cancelled ? CalendarClock : CalendarCheck} color={t.colors.text.primary} strokeWidth={1.75} />
            <Text style={{ flex: 1 }}>
              {cancelled ? `Annulée le ${formatDoneAt(doneAt(b))}` : `Fait le ${formatDoneAt(doneAt(b))}`}
            </Text>
          </View>
          {b.review ? (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
              <Text variant="callout" tone="secondary">
                Votre note
              </Text>
              <StarRating value={b.review.rating} />
            </View>
          ) : b.canReview ? (
            <Pressable
              onPress={() => router.push({ pathname: '/interventions/[id]/notation', params: { id: b.id } })}
              accessibilityRole="button"
              accessibilityLabel="Notez l'artisan"
              testID="completed-review"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: 48, opacity: pressed ? 0.7 : 1 })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.xs,
                  paddingHorizontal: t.spacing.md,
                  paddingVertical: t.spacing.xs,
                  borderRadius: t.radius.full,
                  backgroundColor: t.colors.background.brand,
                  borderWidth: 1,
                  borderColor: t.colors.brand.outline,
                }}
              >
                <Icon icon={Star} size={18} color={t.colors.text.primary} />
                <Text variant="label">
                  Notez l'artisan
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <Icon icon={ChevronRight} color={t.colors.text.secondary} />
            </Pressable>
          ) : null}
        </Card>

        <Card style={{ gap: t.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'center' }}>
            <IconCircle icon={ClipboardList} />
            <Text variant="title2" weight="bold" accessibilityRole="header">
              Détail de l'intervention
            </Text>
          </View>
          <View style={{ gap: t.spacing.xs }}>
            <DetailRow icon={b.kind === 'urgent' ? TriangleAlert : CalendarClock} label={b.kind === 'urgent' ? 'Intervention urgente' : b.scheduledType === 'maintenance' ? 'Entretien sur rendez-vous' : 'Dépannage sur rendez-vous'} />
            <DetailRow icon={DOMAIN_ICONS[b.domain]} label={DOMAIN_LABELS[b.domain]} />
            <DetailRow icon={MessageSquareText} label={b.serviceName ?? b.problemReason} />
            {b.withGuarantee ? <DetailRow icon={ShieldCheck} label="Garantie annulation" /> : null}
            {b.notFeasible ? <DetailRow icon={TriangleAlert} label={NOT_FEASIBLE_LABEL} /> : null}
          </View>
          <Divider />
          <Text variant="title2" weight="bold" accessibilityLabel={`Total : ${formatEuros(total)}`}>
            {cancelled ? (total > 0 ? `Frais de déplacement : ${formatEuros(total)}` : 'Annulée sans frais') : `Total : ${formatEuros(total)}`}
          </Text>
          {b.price.discountCents > 0 ? (
            <Text variant="callout" tone="success">
              Réduction parrainage déduite : {formatEuros(b.price.discountCents)}
            </Text>
          ) : null}
        </Card>

        {showReport ? (
          <Button size="lg" fullWidth icon={FileText} label="Voir le compte rendu" iconRight={ChevronRight} onPress={() => setReportOpen(true)} testID="completed-report" />
        ) : null}
        {invoice || b.status === 'closed' ? (
          <Button size="lg" fullWidth variant="secondary" icon={Receipt} label="Voir la facture" iconRight={ChevronRight} onPress={() => void openInvoice()} testID="completed-invoice" />
        ) : null}
        {!showReport && !invoice ? (
          <EmptyState icon={FileText} title="Pas de compte rendu" message="L'intervention a été annulée avant tout travail." />
        ) : null}
      </View>

      <BottomSheet visible={reportOpen} onClose={() => setReportOpen(false)} title="Compte rendu de l'artisan" scrollable testID="report-sheet">
        <ReportContent booking={b} />
      </BottomSheet>
    </Screen>
  );
}

function Photos({ urls, label }: { urls: string[]; label: string }) {
  const t = useTheme();
  if (!urls.length) return null;
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: t.spacing.sm }}>
      {urls.map((u, i) => (
        <Image key={u} source={{ uri: u }} style={{ width: 104, height: 104, borderRadius: t.radius.sm }} accessibilityLabel={`${label} ${i + 1}`} />
      ))}
    </ScrollView>
  );
}

/** Compte rendu : notes, matériel, photos avant / après, intervention non réalisable. */
function ReportContent({ booking: b }: { booking: BookingDetailDto }) {
  const t = useTheme();
  const r = b.report;
  const nf = b.notFeasible;
  return (
    <View style={{ gap: t.spacing.lg }}>
      {nf ? (
        <Card variant="outline" style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
            <Icon icon={TriangleAlert} color={t.colors.tone.warning.text} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {NOT_FEASIBLE_LABEL}
            </Text>
          </View>
          <Text>Motif : {NOT_FEASIBLE_REASON_LABELS[nf.reason]}</Text>
          {nf.comment ? <Text tone="secondary">{nf.comment}</Text> : null}
          <Photos urls={nf.photoUrls} label="Photo du constat" />
          {nf.rescheduledBookingId ? (
            <Button
              variant="secondary"
              label="Voir le nouveau rendez-vous proposé"
              onPress={() => router.push({ pathname: '/activite/[id]', params: { id: nf.rescheduledBookingId! } })}
            />
          ) : null}
        </Card>
      ) : null}
      {r ? (
        <View style={{ gap: t.spacing.md }}>
          {r.notes ? <Text>{r.notes}</Text> : null}
          {r.materials ? <Text tone="secondary">Matériel : {r.materials}</Text> : null}
          {r.followUpNeeded ? <Text tone="warning">Une intervention complémentaire est conseillée.</Text> : null}
          {r.beforePhotoUrls.length ? <Text variant="label">Avant</Text> : null}
          <Photos urls={r.beforePhotoUrls} label="Photo avant" />
          {r.afterPhotoUrls.length ? <Text variant="label">Après</Text> : null}
          <Photos urls={r.afterPhotoUrls} label="Photo après" />
        </View>
      ) : !nf ? (
        <Text tone="secondary">L'artisan n'a pas encore rédigé de compte rendu.</Text>
      ) : null}
    </View>
  );
}
