import { Inject, Injectable, Logger } from '@nestjs/common';
import { RULES } from '@depano/schemas';
import { and, artisanDocuments, artisanProfiles, eq, files, inArray, isNull, lt, lte, sql } from '@depano/db';
import { DbConnection } from '../../infra/db';
import { StorageService } from '../../infra/storage';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { ReliabilityService } from './reliability.service';
import { PromotionService } from '../artisan/promotion.service';
import { addDays, parisDate } from '../../common/time';

const RETAINED_PURPOSES = ['problem_photo', 'problem_voice', 'report_before', 'report_after', 'chat'] as const;
const DOC_LABELS: Record<string, string> = {
  identity: "Pièce d'identité",
  insurance_decennale: 'Assurance décennale',
  insurance_rc_pro: 'RC professionnelle',
  qualification: 'Qualification',
};

/** Tâches récurrentes : expiration des documents, purge RGPD, fiabilité artisans, renouvellement des promotions. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger('Maintenance');

  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(ReliabilityService) private readonly reliability: ReliabilityService,
    @Inject(PromotionService) private readonly promotion: PromotionService,
  ) {}

  async documentExpiry(now = new Date()) {
    const today = parisDate(now);
    const soon = addDays(today, RULES.documentExpiryReminderDays);
    const db = this.conn.db;
    const expiring = await db
      .select({ d: artisanDocuments, userId: artisanProfiles.userId })
      .from(artisanDocuments)
      .innerJoin(artisanProfiles, eq(artisanProfiles.id, artisanDocuments.artisanId))
      .where(and(eq(artisanDocuments.status, 'approved'), isNull(artisanDocuments.reminderSentAt), lte(artisanDocuments.expiresAt, soon), sql`${artisanDocuments.expiresAt} >= ${today}`));
    for (const { d, userId } of expiring) {
      await this.notifications.notify(userId, {
        type: 'document_expiring',
        title: 'Document bientôt expiré',
        body: `${DOC_LABELS[d.type] ?? 'Un document'} expire le ${new Date(`${d.expiresAt}T12:00:00Z`).toLocaleDateString('fr-FR')}. Téléversez la nouvelle attestation.`,
        link: 'depano://artisan/kyc',
        data: { documentId: d.id },
      });
      await db.update(artisanDocuments).set({ reminderSentAt: now }).where(eq(artisanDocuments.id, d.id));
    }
    const expired = await db
      .update(artisanDocuments)
      .set({ status: 'expired' })
      .where(and(eq(artisanDocuments.status, 'approved'), lt(artisanDocuments.expiresAt, today)))
      .returning();
    for (const d of expired) {
      const [p] = await db.select({ userId: artisanProfiles.userId }).from(artisanProfiles).where(eq(artisanProfiles.id, d.artisanId));
      if (p) {
        await this.notifications.notify(p.userId, {
          type: 'document_expiring',
          title: 'Document expiré',
          body: `${DOC_LABELS[d.type] ?? 'Un document'} a expiré. Mettez-le à jour pour continuer à recevoir des demandes.`,
          link: 'depano://artisan/kyc',
          data: { documentId: d.id },
        });
      }
    }
    return { reminded: expiring.length, expired: expired.length };
  }

  async dataRetention(now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - RULES.dataRetention.chatAndPhotosYears);
    const { messages } = await this.chat.purgeOlderThan(cutoff);
    const old = await this.conn.db
      .select()
      .from(files)
      .where(and(inArray(files.purpose, [...RETAINED_PURPOSES]), isNull(files.deletedAt), lt(files.createdAt, cutoff)))
      .limit(5000);
    for (const f of old) {
      await this.storage.delete(f.storageKey);
      if (f.thumbnailKey) await this.storage.delete(f.thumbnailKey);
      await this.conn.db.update(files).set({ deletedAt: now }).where(eq(files.id, f.id));
    }
    this.logger.log(`purge RGPD : ${messages} messages, ${old.length} fichiers`);
    return { messages, files: old.length };
  }

  reliabilitySweep() {
    return this.reliability.sweep();
  }

  /** Renouvellement des mises en avant échues (prestataire factice ; Stripe renouvelle via invoice.paid). */
  promotionRenewal() {
    return this.promotion.renewExpired();
  }
}
