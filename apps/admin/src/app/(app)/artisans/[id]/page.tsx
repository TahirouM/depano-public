'use client';

import type { AdminArtisanDetailDto, ArtisanDocumentDto, KycChecklistDto } from '@depano/schemas';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check, CircleCheck, CircleX, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { BookingsTable } from '@/components/bookings-table';
import { DomainChip, ToneChip } from '@/components/chips';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FilePreview, PhotoGrid } from '@/components/file-preview';
import { PageHeader } from '@/components/page-header';
import { Field, Section } from '@/components/section';
import { BlockSkeleton, EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatEuros, formatNumber } from '@/lib/format';
import {
  ARTISAN_STATUS_LABELS,
  ARTISAN_STATUS_TONES,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_TONES,
  DOCUMENT_TYPE_LABELS,
  KYC_LABELS,
} from '@/lib/labels';
import { useAction } from '@/lib/use-action';

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function Checklist({ checklist }: { checklist: KycChecklistDto }) {
  const entries = Object.entries(KYC_LABELS) as [keyof KycChecklistDto, string][];
  const done = entries.filter(([k]) => checklist[k]).length;
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {done} / {entries.length} étapes complètes
      </p>
      <ul className="grid gap-2">
        {entries.map(([k, label]) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            {checklist[k] ? (
              <CircleCheck className="size-4 text-success" aria-hidden />
            ) : (
              <CircleX className="size-4 text-urgent" aria-hidden />
            )}
            <span>{label}</span>
            <span className="sr-only">{checklist[k] ? ': complet' : ': manquant'}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function DocumentItem({ doc, artisanId }: { doc: ArtisanDocumentDto; artisanId: string }) {
  const invalidate = [['artisan', artisanId], ['artisans']];
  const approve = useAction({ fn: () => api.admin.approveDocument(doc.id), success: 'Document validé', invalidate });
  const reject = useAction({
    fn: (reason: string) => api.admin.rejectDocument(doc.id, { reason }),
    success: 'Document refusé',
    invalidate,
  });
  const title = `${DOCUMENT_TYPE_LABELS[doc.type]}${doc.label ? ` · ${doc.label}` : ''}`;
  const expired = doc.expiresAt && new Date(doc.expiresAt) < new Date();
  return (
    <li className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[10rem_1fr]">
      <FilePreview url={doc.fileUrl} alt={title} />
      <div className="grid content-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{title}</p>
          <ToneChip tone={DOCUMENT_STATUS_TONES[doc.status]}>{DOCUMENT_STATUS_LABELS[doc.status]}</ToneChip>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <Field label="Déposé le">{formatDate(doc.createdAt)}</Field>
          <Field label="Expire le">
            <span className={expired ? 'font-medium text-urgent' : undefined}>{formatDate(doc.expiresAt)}</span>
          </Field>
        </dl>
        {doc.rejectionReason && <p className="text-sm text-urgent">Motif du refus : {doc.rejectionReason}</p>}
        <div className="flex flex-wrap gap-2">
          {doc.status !== 'approved' && (
            <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate(undefined)}>
              <Check aria-hidden /> Valider
            </Button>
          )}
          {doc.status !== 'rejected' && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline">
                  <X aria-hidden /> Refuser
                </Button>
              }
              title={`Refuser : ${title}`}
              description="L'artisan sera notifié et devra déposer un nouveau document."
              confirmLabel="Refuser le document"
              destructive
              reason={{ label: 'Motif du refus', placeholder: 'Ex. attestation illisible, date expirée…' }}
              onConfirm={(r) => reject.mutateAsync(r!)}
            />
          )}
        </div>
      </div>
    </li>
  );
}

function Decisions({ a }: { a: AdminArtisanDetailDto }) {
  const invalidate = [['artisan', a.id], ['artisans'], ['metrics']];
  const approve = useAction({ fn: () => api.admin.approveArtisan(a.id), success: 'Artisan validé : son profil est visible', invalidate });
  const reject = useAction({ fn: (reason: string) => api.admin.rejectArtisan(a.id, { reason }), success: 'Dossier refusé', invalidate });
  const suspend = useAction({ fn: (reason: string) => api.admin.suspendArtisan(a.id, { reason }), success: 'Artisan suspendu', invalidate });
  const reinstate = useAction({ fn: () => api.admin.reinstateArtisan(a.id), success: 'Artisan réintégré', invalidate });
  const missing = (Object.keys(KYC_LABELS) as (keyof KycChecklistDto)[]).filter((k) => !a.checklist[k]);

  return (
    <div className="flex flex-wrap gap-2">
      {(a.status === 'pending_review' || a.status === 'rejected' || a.status === 'draft') && (
        <ConfirmDialog
          trigger={
            <Button>
              <Check aria-hidden /> Valider l’artisan
            </Button>
          }
          title={`Valider ${a.displayName} ?`}
          description={
            missing.length
              ? `Attention : ${missing.length} étape(s) KYC incomplète(s) (${missing.map((k) => KYC_LABELS[k]).join(', ')}).`
              : 'Le profil deviendra visible et l’artisan pourra recevoir des demandes, y compris en urgence.'
          }
          confirmLabel="Valider"
          onConfirm={() => approve.mutateAsync(undefined)}
        />
      )}
      {a.status === 'pending_review' && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <X aria-hidden /> Refuser
            </Button>
          }
          title={`Refuser le dossier de ${a.displayName}`}
          description="Le motif est envoyé à l'artisan."
          confirmLabel="Refuser le dossier"
          destructive
          reason={{ label: 'Motif du refus' }}
          onConfirm={(r) => reject.mutateAsync(r!)}
        />
      )}
      {a.status === 'approved' && (
        <ConfirmDialog
          trigger={
            <Button variant="destructive">
              <Ban aria-hidden /> Suspendre
            </Button>
          }
          title={`Suspendre ${a.displayName}`}
          description="L'artisan ne recevra plus de nouvelles demandes. Il garde l'accès à son historique et à ses revenus."
          confirmLabel="Suspendre"
          destructive
          reason={{ label: 'Motif de la suspension', placeholder: 'Ex. 3 annulations en 30 jours, assurance expirée…' }}
          onConfirm={(r) => suspend.mutateAsync(r!)}
        />
      )}
      {a.status === 'suspended' && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <RotateCcw aria-hidden /> Réintégrer
            </Button>
          }
          title={`Réintégrer ${a.displayName} ?`}
          description="L'artisan pourra de nouveau recevoir des demandes."
          confirmLabel="Réintégrer"
          onConfirm={() => reinstate.mutateAsync(undefined)}
        />
      )}
    </div>
  );
}

export default function ArtisanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useQuery({ queryKey: ['artisan', id], queryFn: () => api.admin.artisan(id) });

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link href="/artisans">
        <ArrowLeft aria-hidden /> Artisans
      </Link>
    </Button>
  );

  if (q.isPending)
    return (
      <>
        {back}
        <BlockSkeleton className="mb-4 h-16" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <BlockSkeleton className="h-64" />
          <BlockSkeleton className="h-64 lg:col-span-2" />
        </div>
      </>
    );
  if (q.isError) return (
    <>
      {back}
      <ErrorState error={q.error} onRetry={() => q.refetch()} />
    </>
  );

  const a = q.data;
  return (
    <>
      {back}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.displayName}
            <ToneChip tone={ARTISAN_STATUS_TONES[a.status]}>{ARTISAN_STATUS_LABELS[a.status]}</ToneChip>
          </span>
        }
        description={`${a.companyName ?? 'Entreprise inconnue'} · soumis le ${formatDateTime(a.submittedAt)}${a.approvedAt ? ` · validé le ${formatDate(a.approvedAt)}` : ''}`}
        actions={<Decisions a={a} />}
      />
      {a.rejectionReason && (
        <p role="note" className="mb-4 rounded-lg border border-urgent/30 bg-urgent/10 px-3 py-2 text-sm text-urgent">
          Motif enregistré : {a.rejectionReason}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid min-w-0 grid-cols-1 content-start gap-4">
          <Section title="Checklist KYC" id="kyc">
            <Checklist checklist={a.checklist} />
          </Section>
          <Section title="Entreprise" id="company">
            <dl className="grid gap-3">
              <Field label="SIRET">
                <span className="font-mono">{a.siret ?? '—'}</span>
              </Field>
              <Field label="Raison sociale">{a.companyName ?? '—'}</Field>
              <Field label="Adresse">{a.companyAddress ?? '—'}</Field>
              <Field label="Code APE">{a.apeCode ?? '—'}</Field>
              <Field label="État (API Recherche d’entreprises)">
                {a.companyActive === null ? (
                  'Non vérifié'
                ) : a.companyActive ? (
                  <ToneChip tone="success">Active</ToneChip>
                ) : (
                  <ToneChip tone="urgent">Cessée</ToneChip>
                )}
              </Field>
              <Field label="Qualifications">{a.qualifications.length ? a.qualifications.join(', ') : 'Aucune'}</Field>
            </dl>
          </Section>
          <Section title="Contact" id="contact">
            <dl className="grid gap-3">
              <Field label="Téléphone">{a.phone ?? '—'}</Field>
              <Field label="E-mail">{a.email ?? '—'}</Field>
              <Field label="Paiements (Stripe Connect)">
                {a.payoutsEnabled ? <ToneChip tone="success">Actifs</ToneChip> : <ToneChip tone="warning">Non activés</ToneChip>}
              </Field>
            </dl>
          </Section>
          <Section title="Statistiques" id="stats">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Score de fiabilité">{formatNumber(a.reliabilityScore, 0)}</Field>
              <Field label="Annulations (30 j)">
                <span className={a.cancellations30d >= 3 ? 'font-medium text-urgent' : undefined}>{a.cancellations30d}</span>
              </Field>
              <Field label="Dispo urgences">{a.urgentAvailable ? 'Oui' : 'Non'}</Field>
              <Field label="Interventions récentes">{a.recentBookings.length}</Field>
            </dl>
          </Section>
        </div>

        <div className="grid min-w-0 grid-cols-1 content-start gap-4 lg:col-span-2">
          <Section title="Documents" id="docs">
            {a.documents.length === 0 ? (
              <EmptyState title="Aucun document déposé" />
            ) : (
              <ul className="grid gap-3">
                {a.documents.map((d) => (
                  <DocumentItem key={d.id} doc={d} artisanId={a.id} />
                ))}
              </ul>
            )}
          </Section>

          <Section title="Métiers, prestations et tarifs" id="services">
            <div className="mb-3 flex flex-wrap gap-1">
              {a.domains.map((d) => (
                <DomainChip key={d} domain={d} />
              ))}
            </div>
            {a.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune prestation renseignée.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestation</TableHead>
                    <TableHead>Domaine</TableHead>
                    <TableHead className="text-right">Prix</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.services.map((s) => (
                    <TableRow key={s.serviceId}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>
                        <DomainChip domain={s.domain} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatEuros(s.priceCents)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.durationMinutes} min</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>

          <Section title="Zone et horaires" id="zone">
            <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Ville de base">{a.baseCity ?? '—'}</Field>
              <Field label="Rayon">{a.radiusKm} km</Field>
              <Field label="Frais de déplacement">{formatEuros(a.travelFeeCents)}</Field>
              <Field label="Coordonnées">
                {a.baseLat !== null && a.baseLng !== null ? (
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={`https://www.openstreetmap.org/?mlat=${a.baseLat}&mlon=${a.baseLng}#map=12/${a.baseLat}/${a.baseLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {a.baseLat.toFixed(4)}, {a.baseLng.toFixed(4)}
                  </a>
                ) : (
                  '—'
                )}
              </Field>
            </dl>
            {a.availabilityRules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun horaire type.</p>
            ) : (
              <ul className="grid gap-1 text-sm sm:grid-cols-2">
                {[...a.availabilityRules]
                  .sort((x, y) => ((x.weekday + 6) % 7) - ((y.weekday + 6) % 7) || x.start.localeCompare(y.start))
                  .map((r, i) => (
                    <li key={i} className="flex justify-between rounded-md bg-muted px-3 py-1.5">
                      <span>{WEEKDAYS[r.weekday]}</span>
                      <span className="tabular-nums">
                        {r.start} – {r.end}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Section>

          {a.portfolioUrls.length > 0 && (
            <Section title="Réalisations" id="portfolio">
              <PhotoGrid urls={a.portfolioUrls} label="Réalisation" />
            </Section>
          )}

          <Section title="Interventions récentes" id="recent">
            {a.recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune intervention.</p>
            ) : (
              <BookingsTable items={a.recentBookings} counterpartLabel="Client" />
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
