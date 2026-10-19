import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { FilePurpose, UploadUrlBody, UploadUrlDto } from '@depano/schemas';
import {
  and,
  artisanProfiles,
  bookings,
  conversations,
  dispatchOffers,
  eq,
  files,
  inArray,
  interventionReports,
  isNull,
  messages,
  or,
  sql,
} from '@depano/db';
import { DbConnection } from '../../infra/db';
import { StorageService } from '../../infra/storage';
import { JobsService } from '../../infra/jobs';
import type { AuthUser } from '../../common/auth';
import { badRequest, forbidden, notFound } from '../../common/errors';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
};

export const SIGNED_GET_TTL_SECONDS = 300;
const PUBLIC_PURPOSES: FilePurpose[] = ['avatar', 'portfolio', 'review'];

@Injectable()
export class FilesService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(JobsService) private readonly jobs: JobsService,
  ) {}

  async createUpload(user: AuthUser, body: UploadUrlBody): Promise<UploadUrlDto> {
    const id = randomUUID();
    const key = `${body.purpose}/${user.id}/${id}.${EXT[body.contentType] ?? 'bin'}`;
    await this.conn.db.insert(files).values({ id, ownerId: user.id, purpose: body.purpose, storageKey: key, contentType: body.contentType, sizeBytes: body.sizeBytes });
    const ttl = 600;
    return {
      fileId: id,
      uploadUrl: await this.storage.presignPut(key, body.contentType, ttl),
      method: 'PUT',
      headers: { 'Content-Type': body.contentType },
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  async complete(user: AuthUser, id: string) {
    const [f] = await this.conn.db.select().from(files).where(and(eq(files.id, id), isNull(files.deletedAt)));
    if (!f) throw notFound('file_not_found', 'Fichier introuvable.');
    if (f.ownerId !== user.id) throw forbidden('file_forbidden', "Ce fichier ne vous appartient pas.");
    const head = await this.storage.head(f.storageKey);
    if (!head) throw badRequest('upload_missing', "Le fichier n'a pas été téléversé.");
    if (head.size > 15 * 1024 * 1024) throw badRequest('file_too_large', 'Fichier trop volumineux (15 Mo maximum).');
    if (!f.uploadedAt) {
      await this.conn.db.update(files).set({ uploadedAt: new Date(), sizeBytes: head.size || f.sizeBytes }).where(eq(files.id, id));
      if (f.contentType.startsWith('image/')) await this.jobs.add('files', 'thumbnail', { fileId: id });
    }
    return { id, url: await this.storage.presignGet(f.storageKey, SIGNED_GET_TTL_SECONDS) };
  }

  async url(user: AuthUser, id: string) {
    const [f] = await this.conn.db.select().from(files).where(and(eq(files.id, id), isNull(files.deletedAt)));
    if (!f) throw notFound('file_not_found', 'Fichier introuvable.');
    if (!(await this.canAccess(user, f))) throw forbidden('file_forbidden', "Vous n'avez pas accès à ce fichier.");
    return {
      url: await this.storage.presignGet(f.storageKey, SIGNED_GET_TTL_SECONDS),
      expiresAt: new Date(Date.now() + SIGNED_GET_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /** Propriétaire, admin/support, participants de l'intervention pour les photos / chat ; profils publics. */
  async canAccess(user: AuthUser, f: typeof files.$inferSelect): Promise<boolean> {
    if (f.ownerId === user.id) return true;
    if (user.roles.includes('admin') || user.roles.includes('support')) return true;
    if (PUBLIC_PURPOSES.includes(f.purpose as FilePurpose)) return true;
    if (f.purpose === 'document') return false;
    const db = this.conn.db;
    const [artisan] = await db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(eq(artisanProfiles.userId, user.id));
    const participant = or(
      eq(bookings.clientId, user.id),
      artisan ? eq(bookings.artisanId, artisan.id) : sql`false`,
      artisan
        ? sql`exists (select 1 from ${dispatchOffers} d where d.booking_id = ${bookings.id} and d.artisan_id = ${artisan.id})`
        : sql`false`,
    );
    if (f.purpose === 'problem_photo' || f.purpose === 'problem_voice') {
      const r = await db.select({ id: bookings.id }).from(bookings).where(and(sql`${f.id}::uuid = any(${bookings.problemFileIds})`, participant)).limit(1);
      if (r.length) return true;
    }
    if (['report_before', 'report_after', 'problem_voice'].includes(f.purpose)) {
      const r = await db
        .select({ id: bookings.id })
        .from(interventionReports)
        .innerJoin(bookings, eq(bookings.id, interventionReports.bookingId))
        .where(
          and(
            or(
              sql`${f.id}::uuid = any(${interventionReports.beforeFileIds})`,
              sql`${f.id}::uuid = any(${interventionReports.afterFileIds})`,
              eq(interventionReports.voiceFileId, f.id),
            ),
            participant,
          ),
        )
        .limit(1);
      if (r.length) return true;
    }
    const r = await db
      .select({ id: messages.id })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(messages.fileId, f.id), or(eq(conversations.clientUserId, user.id), eq(conversations.artisanUserId, user.id))))
      .limit(1);
    return r.length > 0;
  }

  /** Vérifie que les fichiers appartiennent à l'utilisateur (et ont l'usage attendu). */
  async assertOwned(userId: string, ids: (string | null | undefined)[], purposes?: FilePurpose[]) {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    if (!list.length) return;
    const rows = await this.conn.db
      .select({ id: files.id, ownerId: files.ownerId, purpose: files.purpose })
      .from(files)
      .where(and(inArray(files.id, list), isNull(files.deletedAt)));
    const ok = rows.filter((r) => r.ownerId === userId && (!purposes || purposes.includes(r.purpose as FilePurpose)));
    if (ok.length !== list.length) throw badRequest('invalid_file', 'Fichier invalide ou non autorisé.');
  }

  /** URL signées (5 min) pour une liste d'identifiants, dans l'ordre ; ignore les fichiers absents. */
  async signedUrls(ids: (string | null | undefined)[]): Promise<string[]> {
    const list = ids.filter((x): x is string => !!x);
    if (!list.length) return [];
    const rows = await this.conn.db
      .select({ id: files.id, key: files.storageKey })
      .from(files)
      .where(and(inArray(files.id, [...new Set(list)]), isNull(files.deletedAt)));
    const byId = new Map(rows.map((r) => [r.id, r.key]));
    const out: string[] = [];
    for (const id of list) {
      const key = byId.get(id);
      if (key) out.push(await this.storage.presignGet(key, SIGNED_GET_TTL_SECONDS));
    }
    return out;
  }

  async signedUrl(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    return (await this.signedUrls([id]))[0] ?? null;
  }

  /** Miniature 400 px WebP (worker). */
  async generateThumbnail(fileId: string) {
    const [f] = await this.conn.db.select().from(files).where(eq(files.id, fileId));
    if (!f || f.deletedAt || !f.contentType.startsWith('image/') || f.thumbnailKey) return { skipped: true };
    const { default: sharp } = await import('sharp');
    const input = await this.storage.get(f.storageKey);
    const out = await sharp(input).rotate().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    const key = `thumbnails/${f.storageKey.replace(/\.[a-z0-9]+$/i, '')}.webp`;
    await this.storage.put(key, out, 'image/webp');
    await this.conn.db.update(files).set({ thumbnailKey: key }).where(eq(files.id, fileId));
    return { key };
  }
}
