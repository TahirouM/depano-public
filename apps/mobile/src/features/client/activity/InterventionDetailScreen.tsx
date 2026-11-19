import { DISPUTE_REASON_LABELS, DOMAIN_LABELS, NOT_FEASIBLE_REASON_LABELS, formatEuros } from '@depano/schemas';
import {
  Button,
  Card,
  Divider,
  ErrorState,
  Icon,
  ListItem,
  PriceRow,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonText,
  StarRating,
  StatusChip,
  Text,
  Timeline,
  formatDateTime,
  useTheme,
  useToast,
} from '@depano/ui';
import { router, Stack } from 'expo-router';
import { CalendarClock, CalendarX, FileText, Hourglass, MapPin, Navigation, Receipt, Scale, Star, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { AuthGate } from '@/components/AuthGate';
import { errorMessage } from '@/lib/api';
import { features } from '@/lib/env';
import { useBookingLive } from '@/lib/realtime/hooks';
import { ArtisanContact } from '../components/ArtisanContact';
import { BookingPriceSummary } from '../components/BookingPriceSummary';
import { CancelSheet } from '../components/CancelSheet';
import { CompletionCode } from '../components/CompletionCode';
import { DisputeSheet } from '../components/DisputeSheet';
import { addressLabel, prefillUrgentDraft } from '../drafts';
import { openDocument } from '../openFile';
import { useInvoices } from '../queries';
import { PRICE_ON_REQUEST_LABEL } from '../rdv/useRdv';
import { awaitingPrice, proposalOf, requestDeadline } from './bookingState';
import { ProposalActions } from './ProposalActions';
import { NOT_FEASIBLE_LABEL, buildTimeline } from './timeline';

/**
 * Détail d'une intervention (client) : statut en direct, timeline, artisan, prix, code, devis, actions ;
 * demande en attente de l'artisan, proposition à accepter (prix, nouveau RDV), intervention non réalisable.
 */
export function InterventionDetailScreen({ id }: { id: string }) {
  return (
    <AuthGate title="Intervention" message="Connectez-vous pour suivre cette intervention.">
      <DetailInner id={id} />
    </AuthGate>
  );
}

function Banner({ tone, icon, title, message, action }: { tone: 'warning' | 'info' | 'danger' | 'success'; icon: typeof FileText; title: string; message?: string; action?: { label: string; onPress: () => void; testID?: string } }) {
  const t = useTheme();
  const c = t.colors.tone[tone];
  return (
    <View style={{ backgroundColor: c.soft, borderRadius: t.radius.md, padding: t.spacing.lg, gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
        <Icon icon={icon} color={c.text} />
        <Text variant="bodyStrong" color={c.text} style={{ flex: 1 }}>
          {title}
        </Text>
      </View>
      {message ? <Text variant="callout">{message}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} testID={action.testID} /> : null}
    </View>
  );
}

function DetailInner({ id }: { id: string }) {
  const t = useTheme();
  const toast = useToast();
  const live = useBookingLive(id);
  const b = live.data;
  const invoices = useInvoices();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  if (!b) {
    return (
      <Screen inTabs>
        <Stack.Screen options={{ title: 'Intervention' }} />
        {live.isError ? (
          <ErrorState message={errorMessage(live.error)} onRetry={() => void live.refetch()} />
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            <Skeleton width="50%" height={28} />
            <Skeleton height={120} radius={t.radius.md} />
            <SkeletonText lines={5} />
          </View>
        )}
      </Screen>
    );
  }

  const canCancel = b.allowedTransitions.includes('cancelled_by_client');
  // Un RDV à venir ne se conteste pas encore : « Que s'est-il passé ? » apparaît à partir de l'heure prévue.
  const upcoming = b.status === 'accepted' && !!b.scheduledAt && new Date(b.scheduledAt).getTime() > Date.now();
  const canDispute = b.allowedTransitions.includes('disputed') && !upcoming;
  const invoice = b.invoiceId ? invoices.data?.find((i) => i.id === b.invoiceId) : invoices.data?.find((i) => i.bookingId === b.id && i.kind === 'service');
  const quote = b.quote;
  const finalCents = b.capturedCents ?? (quote?.status === 'accepted' ? quote.totalCents : b.totalCents);

  const openInvoice = async () => {
    if (!invoice?.pdfUrl) {
      toast.show('La facture est en cours de génération. Réessayez dans un instant.');
      void invoices.refetch();
      return;
    }
    await openDocument(invoice.pdfUrl);
  };

  return (
    <Screen
      inTabs
      refreshing={live.isRefetching}
      onRefresh={() => void live.refetch()}
      footer={
        canCancel || canDispute ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {canDispute ? (
              <Button variant="secondary" label="Que s'est-il passé ?" onPress={() => setDisputeOpen(true)} style={{ flex: 1 }} testID="open-dispute" />
            ) : null}
            {canCancel ? <Button variant="ghost" label="Annuler" onPress={() => setCancelOpen(true)} style={{ flex: canDispute ? 0 : 1 }} testID="open-cancel" /> : null}
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `Intervention ${b.reference}` }} />
      <View style={{ gap: t.spacing.xl }} testID="intervention-detail">
        <View style={{ gap: t.spacing.sm }}>
          <StatusChip status={b.status} />
          <Text variant="title1">{b.serviceName ?? b.problemReason}</Text>
          <Text tone="secondary">
            {DOMAIN_LABELS[b.domain]} · {b.kind === 'urgent' ? 'Urgence' : b.scheduledType === 'maintenance' ? 'Entretien' : 'Dépannage'}
            {b.scheduledAt ? ` · ${formatDateTime(b.scheduledAt)}` : ''}
          </Text>
        </View>

        {b.status === 'requested' ? (
          <Banner
            tone="info"
            icon={Hourglass}
            title="En attente de l'artisan"
            message={
              awaitingPrice(b)
                ? `L'artisan va étudier votre demande et vous proposer un prix ; vous pourrez l'accepter ou non. Réponse au plus tard le ${formatDateTime(requestDeadline(b))}.`
                : `${b.artisan?.displayName ?? "L'artisan"} doit accepter votre demande au plus tard le ${formatDateTime(requestDeadline(b))}. Vous êtes prévenu dès sa réponse.`
            }
          />
        ) : null}
        {proposalOf(b) ? (
          <Card variant="outline" style={{ gap: t.spacing.sm }} testID="proposal">
            <ProposalActions booking={b} />
          </Card>
        ) : null}
        {b.notFeasible ? (
          <Banner
            tone="warning"
            icon={TriangleAlert}
            title={NOT_FEASIBLE_LABEL}
            message={[`Motif : ${NOT_FEASIBLE_REASON_LABELS[b.notFeasible.reason]}`, b.notFeasible.comment].filter(Boolean).join('. ')}
            action={
              b.notFeasible.rescheduledBookingId
                ? { label: 'Voir le nouveau rendez-vous proposé', onPress: () => router.push({ pathname: '/activite/[id]', params: { id: b.notFeasible!.rescheduledBookingId! } }), testID: 'open-rescheduled' }
                : undefined
            }
          />
        ) : null}
        {b.status === 'expired' && b.kind === 'scheduled' ? (
          <Banner
            tone="warning"
            icon={CalendarX}
            title="L'artisan n'a pas répondu à temps"
            message="Votre demande a expiré. Rien ne vous a été prélevé."
            action={{ label: 'Reprendre rendez-vous', onPress: () => router.push('/recherche') }}
          />
        ) : null}
        {b.status === 'quote_pending' && quote ? (
          <Banner
            tone="warning"
            icon={FileText}
            title={`Devis à valider : ${formatEuros(quote.totalCents)}`}
            message="Aucun travail ne commence sans votre accord."
            action={{ label: 'Voir le devis', onPress: () => router.push({ pathname: '/activite/[id]/devis', params: { id: b.id } }), testID: 'open-quote' }}
          />
        ) : null}
        {b.status === 'awaiting_code' ? (
          <Banner
            tone="info"
            icon={Star}
            title="Travaux terminés"
            message="Vérifiez le travail, puis donnez votre code à l'artisan pour clôturer."
            action={{ label: 'Terminer l’intervention', onPress: () => router.push({ pathname: '/activite/[id]/fin', params: { id: b.id } }), testID: 'open-end' }}
          />
        ) : null}
        {b.status === 'searching' ? (
          <Banner
            tone="info"
            icon={Navigation}
            title="Recherche d’un artisan en cours"
            action={features.urgent ? { label: 'Suivre la recherche', onPress: () => router.push({ pathname: '/urgence/[bookingId]/recherche', params: { bookingId: b.id } }) } : undefined}
          />
        ) : null}
        {b.status === 'en_route' || (b.status === 'accepted' && b.kind === 'urgent') ? (
          <Banner
            tone="info"
            icon={Navigation}
            title={b.status === 'en_route' ? (b.etaMinutes != null ? `${b.artisan?.displayName ?? "L'artisan"} arrive dans ${b.etaMinutes} min` : 'Artisan en route') : 'Artisan confirmé'}
            action={{ label: 'Suivre en direct', onPress: () => router.push({ pathname: '/urgence/[bookingId]/suivi', params: { bookingId: b.id } }) }}
          />
        ) : null}
        {b.dispute ? (
          <Banner
            tone={b.dispute.status === 'open' ? 'danger' : 'success'}
            icon={Scale}
            title={b.dispute.status === 'open' ? `Litige en cours : ${DISPUTE_REASON_LABELS[b.dispute.reason]}` : 'Litige résolu'}
            message={b.dispute.status === 'open' ? 'Le paiement est gelé. Notre équipe vous répond sous 72 h.' : b.dispute.resolutionNote ?? undefined}
          />
        ) : null}
        {b.status === 'cancelled_by_artisan' ? (
          <Banner
            tone="warning"
            icon={TriangleAlert}
            title="L'artisan a annulé"
            message="Ce n'est pas de votre faute. Rien ne vous a été prélevé."
            action={features.urgent && b.kind === 'urgent' ? { label: 'Relancer une urgence', onPress: () => { prefillUrgentDraft(b); router.push('/urgence/paiement'); } } : { label: 'Reprendre rendez-vous', onPress: () => router.push('/recherche') }}
          />
        ) : null}

        {b.completionCode ? <CompletionCode code={b.completionCode} attemptsLeft={b.completionAttemptsLeft} compact={b.status !== 'awaiting_code'} /> : null}

        {b.status === 'closed' ? (
          b.review ? (
            <Card variant="flat" style={{ gap: t.spacing.xs }}>
              <Text variant="label">Votre avis</Text>
              <StarRating value={b.review.rating} />
              {b.review.comment ? <Text>{b.review.comment}</Text> : null}
            </Card>
          ) : b.canReview ? (
            <Button size="lg" fullWidth icon={Star} label="Noter l'artisan" onPress={() => router.push({ pathname: '/activite/[id]/notation', params: { id: b.id } })} testID="open-review" />
          ) : null
        ) : null}

        {b.artisan ? <ArtisanContact booking={b} /> : null}

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Suivi" />
          <Card>
            <Timeline items={buildTimeline(b)} />
          </Card>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Prix" />
          <Card style={{ gap: t.spacing.md }}>
            {quote?.status === 'accepted' ? (
              <View style={{ gap: t.spacing.sm }}>
                {quote.lines.map((l) => (
                  <PriceRow key={l.id} label={l.quantity !== 1 ? `${l.label} × ${String(l.quantity).replace('.', ',')}` : l.label} cents={l.totalCents} />
                ))}
                <Divider />
                <PriceRow label="Total TTC (devis validé)" cents={quote.totalCents} total />
              </View>
            ) : awaitingPrice(b) ? (
              <View style={{ gap: t.spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md }}>
                  <Text style={{ flex: 1 }}>Prestation</Text>
                  <Text variant="bodyStrong">{PRICE_ON_REQUEST_LABEL}</Text>
                </View>
                {b.price.travelFeeCents > 0 ? <PriceRow label="Déplacement" cents={b.price.travelFeeCents} /> : null}
              </View>
            ) : (
              <BookingPriceSummary price={b.price} showRange={b.kind === 'urgent' && !['closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired'].includes(b.status)} />
            )}
            {b.capturedCents != null ? (
              <Text variant="callout" tone="success">
                Débité : {formatEuros(b.capturedCents)}
              </Text>
            ) : b.status === 'cancelled_by_client' && b.cancellationFeeCents > 0 ? (
              <Text variant="callout" tone="secondary">
                Frais d'annulation : {formatEuros(b.cancellationFeeCents)}
              </Text>
            ) : !['closed', 'cancelled_by_client', 'cancelled_by_artisan', 'expired', 'pending_payment'].includes(b.status) && !awaitingPrice(b) ? (
              <Text variant="callout" tone="secondary">
                Empreinte : {formatEuros(b.authorizedCents || finalCents)}. Vous ne payez qu'à la fin, quand vous donnez le code.
              </Text>
            ) : null}
            {b.withGuarantee ? (
              <Text variant="callout" tone="secondary">
                Garantie annulation souscrite.
              </Text>
            ) : null}
          </Card>
          {invoice || b.status === 'closed' ? (
            <Card padding="none">
              <ListItem icon={Receipt} title="Facture" subtitle={invoice ? invoice.number : 'En cours de génération'} onPress={() => void openInvoice()} testID="open-invoice" />
            </Card>
          ) : null}
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <SectionHeader title="Demande" />
          <Card style={{ gap: t.spacing.md }}>
            <Text variant="bodyStrong">{b.problemReason}</Text>
            {b.problemDescription ? <Text tone="secondary">{b.problemDescription}</Text> : null}
            {b.problemPhotoUrls.length ? (
              <ScrollView horizontal contentContainerStyle={{ gap: t.spacing.sm }}>
                {b.problemPhotoUrls.map((u, i) => (
                  <Image key={u} source={{ uri: u }} style={{ width: 88, height: 88, borderRadius: t.radius.sm }} accessibilityLabel={`Photo ${i + 1} du problème`} />
                ))}
              </ScrollView>
            ) : null}
            <Divider />
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Icon icon={MapPin} size={20} color={t.colors.text.secondary} />
              <View style={{ flex: 1 }}>
                <Text>{addressLabel(b.address)}</Text>
                {[b.address.floor ? `Étage ${b.address.floor}` : null, b.address.doorCode ? `Digicode ${b.address.doorCode}` : null, b.address.accessNotes].filter(Boolean).length ? (
                  <Text variant="callout" tone="secondary">
                    {[b.address.floor ? `Étage ${b.address.floor}` : null, b.address.doorCode ? `Digicode ${b.address.doorCode}` : null, b.address.accessNotes].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Icon icon={CalendarClock} size={20} color={t.colors.text.secondary} />
              <Text variant="callout" tone="secondary">
                Demandée le {formatDateTime(b.createdAt)} · Réf. {b.reference}
              </Text>
            </View>
          </Card>
        </View>

        {b.report ? (
          <View style={{ gap: t.spacing.sm }}>
            <SectionHeader title="Compte rendu de l'artisan" />
            <Card style={{ gap: t.spacing.sm }}>
              {b.report.notes ? <Text>{b.report.notes}</Text> : null}
              {b.report.materials ? <Text tone="secondary">Matériel : {b.report.materials}</Text> : null}
              {b.report.followUpNeeded ? <Text tone="warning">Une intervention complémentaire est conseillée.</Text> : null}
              {[...b.report.beforePhotoUrls, ...b.report.afterPhotoUrls].length ? (
                <ScrollView horizontal contentContainerStyle={{ gap: t.spacing.sm }}>
                  {[...b.report.beforePhotoUrls, ...b.report.afterPhotoUrls].map((u, i) => (
                    <Image key={u} source={{ uri: u }} style={{ width: 88, height: 88, borderRadius: t.radius.sm }} accessibilityLabel={`Photo ${i + 1} du compte rendu`} />
                  ))}
                </ScrollView>
              ) : null}
            </Card>
          </View>
        ) : null}
      </View>
      <CancelSheet booking={b} visible={cancelOpen} onClose={() => setCancelOpen(false)} />
      <DisputeSheet booking={b} visible={disputeOpen} onClose={() => setDisputeOpen(false)} />
    </Screen>
  );
}

