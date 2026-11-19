import { Inject, Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { formatEuros } from '@depano/schemas';
import { addresses, and, artisanProfiles, bookings, desc, eq, files, invoices, quoteLines, quotes, services, sql, users } from '@depano/db';
import type { Tx } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { StorageService } from '../../infra/storage';
import { formatParis } from '../../common/time';

/** Taux de TVA appliqué par défaut (montants affichés TTC). À paramétrer selon le régime de chaque artisan. */
export const DEFAULT_VAT_RATE = 0.2;
export const PLATFORM = {
  name: 'DEPANO SAS',
  siret: '00000000000000',
  address: '1 rue de la République, 13001 Marseille',
  vat: 'FR00000000000',
  mediator: 'Médiateur de la consommation : CM2C, 49 rue de Ponthieu, 75008 Paris — www.cm2c.net',
};

interface Line {
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

const vatOf = (ttc: number, rate = DEFAULT_VAT_RATE) => Math.round(ttc - ttc / (1 + rate));
/** Réduction parrainage (financée par DEPANO) : jamais sur un déplacement seul ni des frais d'annulation. */
const discountLine = (cents: number): Line => ({ label: 'Réduction parrainage', quantity: 1, unitPriceCents: -cents, totalCents: -cents });

/** Facture de prestation (artisan → client) et facture de commission (DEPANO → artisan), PDF via pdfkit. */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger('Invoices');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  /** Numérotation continue par année : F-YYYY-000001 (verrou consultatif transactionnel). */
  async nextNumber(tx: Tx, year: number) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('invoice_number'), ${year}::int)`);
    const [r] = await tx.execute<{ max: string | null }>(sql`select max(number) as max from invoices where number like ${`F-${year}-%`}`);
    const n = r?.max ? Number(r.max.split('-')[2]) + 1 : 1;
    return `F-${year}-${String(n).padStart(6, '0')}`;
  }

  async generate(bookingId: string) {
    const db = this.conn.db;
    const existing = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.bookingId, bookingId));
    if (existing.length) return { skipped: true, count: existing.length };
    const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!b || !b.capturedCents || !b.artisanId) return { skipped: true };
    const [artisan] = await db.select().from(artisanProfiles).where(eq(artisanProfiles.id, b.artisanId));
    const [artisanUser] = await db.select().from(users).where(eq(users.id, artisan!.userId));
    const [client] = await db.select().from(users).where(eq(users.id, b.clientId));
    const [addr] = await db.select().from(addresses).where(eq(addresses.id, b.addressId));
    const [svc] = b.serviceId ? await db.select().from(services).where(eq(services.id, b.serviceId)) : [];

    let lines: Line[];
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.bookingId, b.id), eq(quotes.status, 'accepted'))).orderBy(desc(quotes.createdAt)).limit(1);
    if (b.status === 'cancelled_by_client') {
      lines = [{ label: 'Frais de déplacement (annulation tardive)', quantity: 1, unitPriceCents: b.capturedCents, totalCents: b.capturedCents }];
    } else if (b.travelOnly) {
      lines = [{ label: 'Déplacement (diagnostic sans travaux)', quantity: 1, unitPriceCents: b.capturedCents, totalCents: b.capturedCents }];
    } else if (quote) {
      const ql = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id)).orderBy(quoteLines.position);
      lines = ql.map((l) => ({ label: l.label, quantity: l.quantity, unitPriceCents: l.unitPriceCents, totalCents: l.totalCents }));
      if (b.discountCents) lines.push(discountLine(b.discountCents));
    } else {
      lines = [
        { label: svc?.name ?? b.problemReason, quantity: 1, unitPriceCents: b.basePriceCents, totalCents: b.basePriceCents },
        { label: 'Déplacement', quantity: 1, unitPriceCents: b.travelFeeCents, totalCents: b.travelFeeCents },
        ...(b.urgentFeeCents ? [{ label: "Frais d'urgence", quantity: 1, unitPriceCents: b.urgentFeeCents, totalCents: b.urgentFeeCents }] : []),
        ...(b.guaranteeCents ? [{ label: 'Garantie annulation', quantity: 1, unitPriceCents: b.guaranteeCents, totalCents: b.guaranteeCents }] : []),
        ...(b.discountCents ? [discountLine(b.discountCents)] : []),
      ];
    }
    // Ajustement au montant réellement capturé (capture partielle après litige…)
    const sum = lines.reduce((s, l) => s + l.totalCents, 0);
    if (sum !== b.capturedCents) lines.push({ label: 'Ajustement', quantity: 1, unitPriceCents: b.capturedCents - sum, totalCents: b.capturedCents - sum });

    const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || 'Client';
    const issuedAt = new Date();
    const year = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' }).format(issuedAt));
    const created = await db.transaction(async (tx) => {
      const out: (typeof invoices.$inferSelect)[] = [];
      const serviceNumber = await this.nextNumber(tx, year);
      const total = b.capturedCents!;
      const [inv] = await tx
        .insert(invoices)
        .values({
          number: serviceNumber,
          bookingId: b.id,
          kind: 'service',
          issuerName: artisan!.companyName ?? artisan!.displayName,
          issuerSiret: artisan!.siret,
          recipientName: clientName,
          recipientUserId: b.clientId,
          lines,
          totalExclTaxCents: total - vatOf(total),
          vatCents: vatOf(total),
          totalCents: total,
          issuedAt,
        })
        .returning();
      out.push(inv!);
      if ((b.commissionCents ?? 0) > 0) {
        const c = b.commissionCents!;
        const [ci] = await tx
          .insert(invoices)
          .values({
            number: await this.nextNumber(tx, year),
            bookingId: b.id,
            kind: 'commission',
            issuerName: PLATFORM.name,
            issuerSiret: PLATFORM.siret,
            recipientName: artisan!.companyName ?? artisan!.displayName,
            recipientUserId: artisan!.userId,
            lines: [{ label: `Commission de mise en relation — intervention ${b.reference} (${Math.round(b.commissionRate * 100)} %)`, quantity: 1, unitPriceCents: c, totalCents: c }],
            totalExclTaxCents: c - vatOf(c),
            vatCents: vatOf(c),
            totalCents: c,
            issuedAt,
          })
          .returning();
        out.push(ci!);
      }
      return out;
    });

    for (const inv of created) {
      const pdf = await this.renderPdf(inv, {
        reference: b.reference,
        date: b.closedAt ?? b.cancelledAt ?? issuedAt,
        issuerAddress: inv.kind === 'service' ? (artisan!.companyAddress ?? '') : PLATFORM.address,
        recipientAddress: inv.kind === 'service' ? (addr ? `${addr.line1}, ${addr.postalCode} ${addr.city}` : '') : (artisan!.companyAddress ?? ''),
        recipientEmail: inv.kind === 'service' ? (client?.email ?? null) : (artisanUser?.email ?? null),
        keepParts: quote?.keepReplacedParts ?? null,
      });
      const key = `invoices/${year}/${inv.number}.pdf`;
      await this.storage.put(key, pdf, 'application/pdf');
      const [f] = await db
        .insert(files)
        .values({ ownerId: inv.recipientUserId, purpose: 'document', storageKey: key, contentType: 'application/pdf', sizeBytes: pdf.length, uploadedAt: new Date() })
        .onConflictDoNothing()
        .returning();
      if (f) await db.update(invoices).set({ fileId: f.id }).where(eq(invoices.id, inv.id));
    }
    this.logger.log(`factures ${created.map((i) => i.number).join(', ')} pour ${b.reference}`);
    return { created: created.map((i) => i.number) };
  }

  renderPdf(
    inv: typeof invoices.$inferSelect,
    ctx: { reference: string; date: Date; issuerAddress: string; recipientAddress: string; recipientEmail: string | null; keepParts: boolean | null },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Facture ${inv.number}`, Author: 'DEPANO' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(inv.kind === 'service' ? 'FACTURE' : 'FACTURE DE COMMISSION', { align: 'right' });
      doc.fontSize(10).text(`N° ${inv.number}`, { align: 'right' }).text(`Date : ${formatParis(inv.issuedAt, { dateStyle: 'long' })}`, { align: 'right' });
      doc.moveDown();
      doc.fontSize(11).text('Émetteur', { underline: true }).fontSize(10).text(inv.issuerName);
      if (ctx.issuerAddress) doc.text(ctx.issuerAddress);
      if (inv.issuerSiret) doc.text(`SIRET : ${inv.issuerSiret}`);
      if (inv.kind === 'commission') doc.text(`TVA intracommunautaire : ${PLATFORM.vat}`);
      doc.moveDown();
      doc.fontSize(11).text('Destinataire', { underline: true }).fontSize(10).text(inv.recipientName);
      if (ctx.recipientAddress) doc.text(ctx.recipientAddress);
      if (ctx.recipientEmail) doc.text(ctx.recipientEmail);
      doc.moveDown();
      doc.text(`Intervention ${ctx.reference} du ${formatParis(ctx.date, { dateStyle: 'long' })}`);
      doc.moveDown();

      const y0 = doc.y;
      doc.font('Helvetica-Bold').text('Désignation', 50, y0).text('Qté', 330, y0, { width: 40, align: 'right' }).text('PU TTC', 380, y0, { width: 70, align: 'right' }).text('Total TTC', 460, y0, { width: 85, align: 'right' });
      doc.font('Helvetica');
      doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke();
      doc.moveDown(0.6);
      for (const l of inv.lines as Line[]) {
        const y = doc.y;
        doc.text(l.label, 50, y, { width: 270 });
        const after = doc.y;
        doc.text(String(l.quantity), 330, y, { width: 40, align: 'right' }).text(formatEuros(l.unitPriceCents), 380, y, { width: 70, align: 'right' }).text(formatEuros(l.totalCents), 460, y, { width: 85, align: 'right' });
        doc.y = Math.max(after, doc.y) + 4;
      }
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown();
      const row = (label: string, value: string, bold = false) => {
        const y = doc.y;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 330, y, { width: 120, align: 'right' }).text(value, 460, y, { width: 85, align: 'right' });
        doc.moveDown(0.3);
      };
      row('Total HT', formatEuros(inv.totalExclTaxCents));
      row(`TVA (${Math.round(DEFAULT_VAT_RATE * 100)} %)`, formatEuros(inv.vatCents));
      row('Total TTC', formatEuros(inv.totalCents), true);
      doc.font('Helvetica').moveDown(2).fontSize(8);
      doc.text(`Facture acquittée : réglée par carte bancaire via la plateforme DEPANO le ${formatParis(ctx.date, { dateStyle: 'long' })}.`, 50);
      doc.text("Pas d'escompte pour paiement anticipé.");
      if (inv.kind === 'service') {
        doc.text('Devis détaillé remis et accepté avant toute intervention (arrêté du 24 janvier 2017).');
        if (ctx.keepParts !== null) doc.text(ctx.keepParts ? 'Les pièces remplacées ont été laissées au client.' : 'Le client a renoncé à conserver les pièces remplacées.');
        doc.text('Assurance décennale et RC professionnelle : attestations disponibles sur le profil de l’artisan.');
        doc.text(PLATFORM.mediator);
        doc.text(`Facture émise par ${PLATFORM.name} au nom et pour le compte de l'artisan (mandat de facturation).`);
      } else {
        doc.text('Indemnité forfaitaire pour frais de recouvrement en cas de retard : 40 €. Pénalités de retard : 3 fois le taux d’intérêt légal.');
        doc.text(`${PLATFORM.name} — ${PLATFORM.address} — SIRET ${PLATFORM.siret}`);
      }
      doc.end();
    });
  }
}
