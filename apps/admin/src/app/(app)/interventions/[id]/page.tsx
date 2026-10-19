'use client';

import { DISPUTE_REASON_LABELS, type AdminBookingDetailDto } from '@depano/schemas';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Gavel, MapPin, Phone, Star } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo } from 'react';
import { BookingMap, type MapPoint } from '@/components/booking-map';
import { BookingStatusChip, DomainChip, KindChip, ToneChip } from '@/components/chips';
import { PhotoGrid } from '@/components/file-preview';
import { PageHeader } from '@/components/page-header';
import { ResolveDisputeDialog } from '@/components/resolve-dispute-dialog';
import { Field, Section } from '@/components/section';
import { BlockSkeleton, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, formatEuros, formatTime, formatTimestamp } from '@/lib/format';
import {
  ACTOR_LABELS,
  ADMIN_BOOKING_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_TONES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  QUOTE_LINE_KIND_LABELS,
  QUOTE_STATUS_LABELS,
  RESOLUTION_LABELS,
} from '@/lib/labels';
import { cn } from '@/lib/utils';

type B = AdminBookingDetailDto;

function Timeline({ b }: { b: B }) {
  const events = [...b.events].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Aucun événement.</p>;
  return (
    <ol className="relative grid gap-4 border-l pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            aria-hidden
            className={cn(
              'absolute top-1 -left-[1.6rem] size-3 rounded-full border-2 border-card',
              e.toStatus === 'disputed' ? 'bg-urgent' : e.toStatus === 'closed' ? 'bg-success' : 'bg-primary',
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusChip status={e.toStatus} />
            <span className="text-xs text-muted-foreground">
              par <span className="font-medium text-foreground">{ACTOR_LABELS[e.actor]}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <time dateTime={e.createdAt}>{formatTimestamp(e.createdAt)}</time>
            {e.fromStatus && <> · depuis « {ADMIN_BOOKING_STATUS_LABELS[e.fromStatus]} »</>}
          </p>
          {e.lat !== null && e.lng !== null ? (
            <p className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              {e.lat.toFixed(5)}, {e.lng.toFixed(5)}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Pas de position GPS</p>
          )}
          {e.note && <p className="mt-1 text-sm">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

function Chat({ b }: { b: B }) {
  if (b.messages.length === 0) return <p className="text-sm text-muted-foreground">Aucun message échangé.</p>;
  const messages = [...b.messages].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  return (
    <ol className="grid max-h-[32rem] gap-3 overflow-y-auto pr-1" aria-label="Transcription du chat">
      {messages.map((m) => {
        const who = m.kind === 'system' || !m.senderId ? 'system' : m.senderId === b.client?.id ? 'client' : 'artisan';
        const name = who === 'system' ? 'Système' : who === 'client' ? `Client · ${b.client?.firstName ?? ''}` : `Artisan · ${b.artisan?.displayName ?? ''}`;
        return (
          <li key={m.id} className={cn('flex', who === 'client' ? 'justify-start' : who === 'artisan' ? 'justify-end' : 'justify-center')}>
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                who === 'client' && 'bg-muted',
                who === 'artisan' && 'bg-secondary',
                who === 'system' && 'border border-dashed text-xs text-muted-foreground',
              )}
            >
              <p className="mb-0.5 text-xs font-medium text-muted-foreground">
                {name} · {formatDateTime(m.createdAt)}
              </p>
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
              {m.fileUrl && m.kind === 'image' && (
                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL signée */}
                  <img src={m.fileUrl} alt="Photo envoyée dans le chat" className="mt-1 max-h-48 rounded-lg" loading="lazy" />
                </a>
              )}
              {m.fileUrl && m.kind === 'voice' && <audio controls src={m.fileUrl} className="mt-1 w-56" aria-label="Message vocal" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Payments({ b }: { b: B }) {
  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Prix annoncé">{formatEuros(b.price.totalCents)}</Field>
        <Field label="Autorisé">{formatEuros(b.authorizedCents)}</Field>
        <Field label="Capturé">{b.capturedCents === null ? '—' : formatEuros(b.capturedCents)}</Field>
        <Field label="Commission">{b.commissionCents === null ? '—' : formatEuros(b.commissionCents)}</Field>
      </dl>
      <p className="mb-3 text-xs text-muted-foreground">
        Base {formatEuros(b.price.baseCents)} · urgence {formatEuros(b.price.urgentFeeCents)} · déplacement {formatEuros(b.price.travelFeeCents)} ·
        garantie {formatEuros(b.price.guaranteeCents)}
      </p>
      {b.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun paiement.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Capturé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {b.payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(p.createdAt)}</TableCell>
                <TableCell>
                  <ToneChip tone={PAYMENT_STATUS_TONES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</ToneChip>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {p.provider}
                  {p.providerRef ? ` · ${p.providerRef}` : ''}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatEuros(p.amountCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{p.capturedCents === null ? '—' : formatEuros(p.capturedCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function Quote({ b }: { b: B }) {
  if (!b.quote) return <p className="text-sm text-muted-foreground">Aucun devis.</p>;
  const q = b.quote;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <ToneChip tone={q.status === 'accepted' ? 'success' : q.status === 'refused' ? 'urgent' : 'warning'}>{QUOTE_STATUS_LABELS[q.status]}</ToneChip>
        <span className="text-muted-foreground">
          Envoyé le {formatDateTime(q.createdAt)}
          {q.answeredAt && ` · répondu le ${formatDateTime(q.answeredAt)}`}
        </span>
        {q.needsNewAuthorization && <ToneChip tone="warning">Dépasse +20 % : nouvelle autorisation</ToneChip>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ligne</TableHead>
            <TableHead>Nature</TableHead>
            <TableHead className="text-right">Qté</TableHead>
            <TableHead className="text-right">P.U.</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.label}</TableCell>
              <TableCell>{QUOTE_LINE_KIND_LABELS[l.kind]}</TableCell>
              <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEuros(l.unitPriceCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatEuros(l.totalCents)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total TTC</TableCell>
            <TableCell className="text-right tabular-nums">{formatEuros(q.totalCents)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        Pièces remplacées {q.keepReplacedParts ? 'conservées par le client' : 'non conservées'}.
      </p>
    </>
  );
}

function Dispatch({ b }: { b: B }) {
  if (b.kind !== 'urgent') return <p className="text-sm text-muted-foreground">RDV planifié : pas de dispatch.</p>;
  if (b.dispatchOffers.length === 0) return <p className="text-sm text-muted-foreground">Aucune offre envoyée.</p>;
  const waves = new Map<number, B['dispatchOffers']>();
  for (const o of b.dispatchOffers) waves.set(o.wave, [...(waves.get(o.wave) ?? []), o]);
  return (
    <div className="grid grid-cols-1 gap-4">
      {[...waves.entries()]
        .sort(([x], [y]) => x - y)
        .map(([wave, offers]) => (
          <div key={wave}>
            <h4 className="mb-2 text-sm font-medium">
              Vague {wave} <span className="font-normal text-muted-foreground">· {offers.length} artisan(s)</span>
            </h4>
            <ul className="grid gap-1.5">
              {offers.map((o, i) => (
                <li key={`${o.artisanId}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <Link href={`/artisans/${o.artisanId}`} className="font-medium hover:underline">
                    {o.artisanName}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {o.distanceKm.toFixed(1)} km · {formatTime(o.createdAt)}
                    <ToneChip tone={OFFER_STATUS_TONES[o.status]}>{OFFER_STATUS_LABELS[o.status]}</ToneChip>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

function DisputeBlock({ b }: { b: B }) {
  const d = b.dispute;
  if (!d) return null;
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Gavel className="size-4 text-urgent" aria-hidden /> Litige
        </span>
      }
      id="dispute"
      className={d.status === 'open' ? 'border-urgent/40' : undefined}
      actions={
        d.status === 'open' ? (
          <ResolveDisputeDialog
            disputeId={d.id}
            reference={b.reference}
            amountCents={b.authorizedCents}
            bookingId={b.id}
            trigger={<Button size="sm">Trancher</Button>}
          />
        ) : undefined
      }
    >
      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Motif">{DISPUTE_REASON_LABELS[d.reason]}</Field>
        <Field label="Ouvert le">{formatDateTime(d.createdAt)}</Field>
        <Field label="Statut">{d.status === 'open' ? <ToneChip tone="urgent">Ouvert · capture gelée</ToneChip> : <ToneChip tone="success">Résolu</ToneChip>}</Field>
      </dl>
      {d.description && <p className="mt-3 rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{d.description}</p>}
      {d.status === 'resolved' && (
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Décision">{d.resolution ? RESOLUTION_LABELS[d.resolution] : '—'}</Field>
          <Field label="Remboursé">{d.refundedCents === null ? '—' : formatEuros(d.refundedCents)}</Field>
          <Field label="Résolu le">{formatDateTime(d.resolvedAt)}</Field>
          {d.resolutionNote && (
            <div className="sm:col-span-3">
              <Field label="Note">{d.resolutionNote}</Field>
            </div>
          )}
        </dl>
      )}
    </Section>
  );
}

export default function InterventionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api.admin.booking(id) });

  const map = useMemo(() => {
    const b = q.data;
    if (!b) return { points: [] as MapPoint[], track: [] as [number, number][] };
    const points: MapPoint[] = [];
    const lat = b.address.lat ?? b.address.approxLat;
    const lng = b.address.lng ?? b.address.approxLng;
    points.push({ lat, lng, kind: 'address', label: 'Adresse d’intervention', detail: [b.address.line1, b.address.postalCode, b.address.city].filter(Boolean).join(' ') });
    for (const e of b.events)
      if (e.lat !== null && e.lng !== null)
        points.push({ lat: e.lat, lng: e.lng, kind: 'event', label: ADMIN_BOOKING_STATUS_LABELS[e.toStatus], detail: `${ACTOR_LABELS[e.actor]} · ${formatDateTime(e.createdAt)}` });
    const track = [...b.locations].sort((x, y) => x.at.localeCompare(y.at)).map((l) => [l.lat, l.lng] as [number, number]);
    return { points, track };
  }, [q.data]);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link href="/interventions">
        <ArrowLeft aria-hidden /> Interventions
      </Link>
    </Button>
  );

  if (q.isPending)
    return (
      <>
        {back}
        <BlockSkeleton className="mb-4 h-16" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BlockSkeleton className="h-96" />
          <BlockSkeleton className="h-96" />
        </div>
      </>
    );
  if (q.isError)
    return (
      <>
        {back}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );

  const b = q.data;
  return (
    <>
      {back}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{b.reference}</span>
            <BookingStatusChip status={b.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <KindChip kind={b.kind} />
            <DomainChip domain={b.domain} />
            <span>
              {b.serviceName ?? b.problemReason} · créée le {formatDateTime(b.createdAt)}
              {b.scheduledAt && ` · prévue le ${formatDateTime(b.scheduledAt)}`}
            </span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <DisputeBlock b={b} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Section title="Client" id="client">
            <dl className="grid gap-2">
              <Field label="Prénom">{b.client?.firstName ?? '—'}</Field>
              <Field label="Téléphone">
                {b.clientPhone ? (
                  <a href={`tel:${b.clientPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="size-3" aria-hidden /> {b.clientPhone}
                  </a>
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Adresse">
                {[b.address.line1, `${b.address.postalCode} ${b.address.city}`].filter(Boolean).join(', ')}
                {(b.address.floor || b.address.doorCode) && (
                  <span className="block text-xs text-muted-foreground">
                    {b.address.floor && `Étage ${b.address.floor}`} {b.address.doorCode && `· Code ${b.address.doorCode}`}
                  </span>
                )}
              </Field>
              {b.address.accessNotes && <Field label="Accès">{b.address.accessNotes}</Field>}
            </dl>
          </Section>
          <Section title="Artisan" id="artisan">
            {b.artisan ? (
              <dl className="grid gap-2">
                <Field label="Nom">
                  <Link href={`/artisans/${b.artisan.id}`} className="text-primary hover:underline">
                    {b.artisan.displayName}
                  </Link>
                </Field>
                <Field label="Téléphone">
                  {b.artisanPhone ? (
                    <a href={`tel:${b.artisanPhone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Phone className="size-3" aria-hidden /> {b.artisanPhone}
                    </a>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Note moyenne">{b.artisan.ratingAvg?.toFixed(1) ?? '—'}</Field>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun artisan assigné.</p>
            )}
          </Section>
          <Section title="Demande" id="request">
            <dl className="grid gap-2">
              <Field label="Motif">{b.problemReason}</Field>
              {b.problemDescription && <Field label="Description">{b.problemDescription}</Field>}
              <Field label="Garantie annulation">{b.withGuarantee ? 'Souscrite' : 'Non'}</Field>
              <Field label="Code de fin">{`${b.completionAttemptsLeft} essai(s) restant(s)`}</Field>
            </dl>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Timeline des statuts" id="timeline">
            <Timeline b={b} />
          </Section>
          <Section title="Positions GPS horodatées" id="map">
            <BookingMap points={map.points} track={map.track} />
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Chat" id="chat">
            <Chat b={b} />
          </Section>
          <Section title="Photos" id="photos">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <h4 className="mb-2 text-sm font-medium">Problème (client)</h4>
                <PhotoGrid urls={b.problemPhotoUrls} label="Photo du problème" />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">Avant travaux</h4>
                <PhotoGrid urls={b.report?.beforePhotoUrls ?? []} label="Photo avant" />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">Après travaux</h4>
                <PhotoGrid urls={b.report?.afterPhotoUrls ?? []} label="Photo après" />
              </div>
            </div>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Devis" id="quote">
            <Quote b={b} />
          </Section>
          <Section title="Paiements" id="payments">
            <Payments b={b} />
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section title="Dispatch urgence" id="dispatch">
            <Dispatch b={b} />
          </Section>
          <Section title="Compte rendu et avis" id="report">
            {b.report ? (
              <dl className="mb-4 grid gap-2">
                <Field label="Réalisable">{b.report.feasible ? 'Oui' : 'Non'}</Field>
                {b.report.materials && <Field label="Matériel">{b.report.materials}</Field>}
                {b.report.notes && <Field label="Notes">{b.report.notes}</Field>}
                {b.report.voiceTranscript && <Field label="Note vocale (transcription)">{b.report.voiceTranscript}</Field>}
                <Field label="Suivi nécessaire">{b.report.followUpNeeded ? 'Oui' : 'Non'}</Field>
              </dl>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">Pas de compte rendu.</p>
            )}
            {b.review ? (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="flex items-center gap-1 font-medium">
                  <Star className="size-4 fill-warning text-warning" aria-hidden /> {b.review.rating} / 5 · {b.review.authorFirstName}
                </p>
                {b.review.comment && <p className="mt-1">{b.review.comment}</p>}
                {b.review.tags.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{b.review.tags.join(' · ')}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pas d’avis.</p>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
