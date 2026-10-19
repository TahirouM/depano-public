import { Inject, Injectable } from '@nestjs/common';
import {
  ACTIVE_BOOKING_STATUSES,
  type AddressBody,
  type AddressDto,
  type ArtisanCardDto,
  type BadgesDto,
  type InvoiceDto,
  type Me,
  type PushTokenBody,
  type NotificationPrefsBody,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
  type Role,
  type SetActiveRoleBody,
  type SetupIntentDto,
  type UpdateMeBody,
} from '@depano/schemas';
import {
  addresses,
  and,
  artisanProfiles,
  bookings,
  clientProfiles,
  consents,
  desc,
  disputes,
  eq,
  favorites,
  inArray,
  invoices,
  isNull,
  messages,
  ne,
  notifications,
  or,
  passkeys,
  payments,
  pushTokens,
  reviews,
  sql,
  users,
} from '@depano/db';
import { DbConnection } from '../../infra/db';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { PaymentsService } from '../payments/payments.service';
import { TokenService } from '../auth/token.service';
import { CatalogService } from '../catalog/catalog.service';
import type { AuthUser } from '../../common/auth';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';

type AddressRow = typeof addresses.$inferSelect;
const toAddressDto = (a: AddressRow): AddressDto => ({
  id: a.id,
  label: a.label,
  line1: a.line1,
  postalCode: a.postalCode,
  city: a.city,
  floor: a.floor,
  doorCode: a.doorCode,
  accessNotes: a.accessNotes,
  lat: a.lat,
  lng: a.lng,
  isDefault: a.isDefault,
});

@Injectable()
export class MeService {
  constructor(
    @Inject(DbConnection) private readonly conn: DbConnection,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(ChatService) private readonly chat: ChatService,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  async toMe(userId: string): Promise<Me> {
    const [u] = await this.conn.db.select().from(users).where(eq(users.id, userId));
    if (!u || u.deletedAt) throw notFound('user_not_found', 'Utilisateur introuvable.');
    const [a] = await this.conn.db
      .select({ id: artisanProfiles.id, status: artisanProfiles.status, urgentAvailable: artisanProfiles.urgentAvailable })
      .from(artisanProfiles)
      .where(eq(artisanProfiles.userId, userId));
    return {
      id: u.id,
      phone: u.phone,
      phoneVerified: !!u.phoneVerifiedAt,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      avatarUrl: await this.filesService.signedUrl(u.avatarFileId),
      roles: u.roles as Role[],
      activeRole: u.activeRole === 'artisan' && a ? 'artisan' : 'client',
      artisan: a ? { id: a.id, status: a.status, urgentAvailable: a.urgentAvailable } : null,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async update(user: AuthUser, body: UpdateMeBody): Promise<Me> {
    if (body.avatarFileId) await this.filesService.assertOwned(user.id, [body.avatarFileId], ['avatar']);
    await this.conn.db
      .update(users)
      .set({
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.avatarFileId !== undefined ? { avatarFileId: body.avatarFileId } : {}),
      })
      .where(eq(users.id, user.id));
    return this.toMe(user.id);
  }

  /** Bascule client ⇄ artisan ; passer en artisan sans profil crée un brouillon. */
  async setActiveRole(user: AuthUser, body: SetActiveRoleBody): Promise<Me> {
    if (body.role === 'artisan') await this.ensureArtisanDraft(user.id);
    await this.conn.db.update(users).set({ activeRole: body.role }).where(eq(users.id, user.id));
    return this.toMe(user.id);
  }

  async ensureArtisanDraft(userId: string, defaults: { displayName?: string } = {}) {
    const [existing] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.userId, userId));
    if (existing) return existing;
    const [u] = await this.conn.db.select().from(users).where(eq(users.id, userId));
    const displayName =
      defaults.displayName ?? ([u?.firstName, u?.lastName ? `${u.lastName[0]}.` : null].filter(Boolean).join(' ') || 'Artisan');
    await this.conn.db.insert(artisanProfiles).values({ userId, displayName: displayName.slice(0, 80), status: 'draft' }).onConflictDoNothing();
    await this.conn.db
      .update(users)
      .set({ roles: sql`(select array_agg(distinct r) from unnest(${users.roles} || ARRAY['artisan']::role[]) r)` })
      .where(eq(users.id, userId));
    const [p] = await this.conn.db.select().from(artisanProfiles).where(eq(artisanProfiles.userId, userId));
    return p!;
  }

  /** Suppression (RGPD) : anonymisation, sessions révoquées ; factures et paiements conservés. */
  async delete(user: AuthUser) {
    const db = this.conn.db;
    const [artisan] = await db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(eq(artisanProfiles.userId, user.id));
    const [active] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES, 'disputed']),
          or(eq(bookings.clientId, user.id), artisan ? eq(bookings.artisanId, artisan.id) : sql`false`),
        ),
      );
    if ((active?.n ?? 0) > 0) throw conflict('active_bookings', 'Terminez ou annulez vos interventions en cours avant de supprimer votre compte.');
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ phone: null, email: null, firstName: null, lastName: null, avatarFileId: null, appleSub: null, googleSub: null, deletedAt: new Date(), roles: ['client'], activeRole: 'client' })
        .where(eq(users.id, user.id));
      await tx.delete(pushTokens).where(eq(pushTokens.userId, user.id));
      await tx.delete(passkeys).where(eq(passkeys.userId, user.id));
      await tx.update(addresses).set({ deletedAt: new Date() }).where(and(eq(addresses.userId, user.id), isNull(addresses.deletedAt)));
      await tx.delete(favorites).where(eq(favorites.userId, user.id));
      if (artisan) {
        await tx
          .update(artisanProfiles)
          .set({ status: 'suspended', urgentAvailable: false, bio: null, currentLat: null, currentLng: null, displayName: 'Compte supprimé' })
          .where(eq(artisanProfiles.id, artisan.id));
      }
    });
    await this.tokens.revokeAllForUser(user.id);
  }

  /** Export RGPD (droit d'accès). */
  async exportData(user: AuthUser) {
    const db = this.conn.db;
    const [u] = await db.select().from(users).where(eq(users.id, user.id));
    const [artisan] = await db.select().from(artisanProfiles).where(eq(artisanProfiles.userId, user.id));
    const myBookings = await db.select().from(bookings).where(or(eq(bookings.clientId, user.id), artisan ? eq(bookings.artisanId, artisan.id) : sql`false`));
    const ids = myBookings.map((b) => b.id);
    return {
      exportedAt: new Date().toISOString(),
      user: u ? { ...u, stripeCustomerId: undefined, appleSub: undefined, googleSub: undefined } : null,
      clientProfile: (await db.select().from(clientProfiles).where(eq(clientProfiles.userId, user.id)))[0] ?? null,
      artisanProfile: artisan ?? null,
      addresses: await db.select().from(addresses).where(eq(addresses.userId, user.id)),
      bookings: myBookings.map((b) => ({ ...b, completionCodeHash: undefined, completionCodeEnc: undefined })),
      payments: ids.length ? await db.select().from(payments).where(inArray(payments.bookingId, ids)) : [],
      invoices: await db.select().from(invoices).where(eq(invoices.recipientUserId, user.id)),
      reviewsWritten: await db.select().from(reviews).where(eq(reviews.authorId, user.id)),
      disputes: await db.select().from(disputes).where(eq(disputes.openedBy, user.id)),
      messagesSent: await db.select().from(messages).where(eq(messages.senderId, user.id)),
      notifications: await db.select().from(notifications).where(eq(notifications.userId, user.id)),
      consents: await db.select().from(consents).where(eq(consents.userId, user.id)),
      favorites: await db.select().from(favorites).where(eq(favorites.userId, user.id)),
    };
  }

  async badges(user: AuthUser): Promise<BadgesDto> {
    const [artisan] = await this.conn.db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(eq(artisanProfiles.userId, user.id));
    const [act] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES, 'disputed']),
          or(eq(bookings.clientId, user.id), artisan ? eq(bookings.artisanId, artisan.id) : sql`false`),
        ),
      );
    return { notifications: await this.notifications.unreadCount(user.id), messages: await this.chat.totalUnread(user.id), activity: act?.n ?? 0 };
  }

  async registerPushToken(user: AuthUser, body: PushTokenBody) {
    await this.conn.db
      .insert(pushTokens)
      .values({ userId: user.id, token: body.token, platform: body.platform })
      .onConflictDoUpdate({ target: pushTokens.token, set: { userId: user.id, platform: body.platform, disabledAt: null, updatedAt: new Date() } });
  }

  /** Désinscription d'un jeton (déconnexion) : uniquement s'il appartient à l'utilisateur. Idempotent. */
  async unregisterPushToken(user: AuthUser, token: string) {
    await this.conn.db.delete(pushTokens).where(and(eq(pushTokens.userId, user.id), eq(pushTokens.token, token)));
  }

  /* ---------------------- Préférences de notifications ---------------------- */

  async notificationPrefs(user: AuthUser): Promise<NotificationPrefs> {
    const [u] = await this.conn.db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, user.id));
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(u?.prefs ?? {}) };
  }

  async updateNotificationPrefs(user: AuthUser, body: NotificationPrefsBody): Promise<NotificationPrefs> {
    // Fusion atomique dans le jsonb (pas de lecture-écriture concurrente).
    await this.conn.db
      .update(users)
      .set({ notificationPrefs: sql`${users.notificationPrefs} || ${JSON.stringify(body)}::jsonb`, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return this.notificationPrefs(user);
  }

  /* ------------------------------ Adresses ----------------------------- */

  async addresses(user: AuthUser): Promise<AddressDto[]> {
    const rows = await this.conn.db
      .select()
      .from(addresses)
      .where(and(eq(addresses.userId, user.id), isNull(addresses.deletedAt)))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
    return rows.map(toAddressDto);
  }

  private async ownedAddress(user: AuthUser, id: string) {
    const [a] = await this.conn.db.select().from(addresses).where(and(eq(addresses.id, id), isNull(addresses.deletedAt)));
    if (!a) throw notFound('address_not_found', 'Adresse introuvable.');
    if (a.userId !== user.id) throw forbidden('address_forbidden', 'Cette adresse ne vous appartient pas.');
    return a;
  }

  private async setDefault(userId: string, addressId: string) {
    await this.conn.db.update(addresses).set({ isDefault: false }).where(and(eq(addresses.userId, userId), ne(addresses.id, addressId)));
    await this.conn.db.update(clientProfiles).set({ defaultAddressId: addressId }).where(eq(clientProfiles.userId, userId));
  }

  async createAddress(user: AuthUser, body: AddressBody): Promise<AddressDto> {
    const [{ n } = { n: 0 }] = await this.conn.db
      .select({ n: sql<number>`count(*)::int` })
      .from(addresses)
      .where(and(eq(addresses.userId, user.id), isNull(addresses.deletedAt)));
    if (n >= 20) throw badRequest('too_many_addresses', "Vous avez atteint le nombre maximal d'adresses.");
    const isDefault = body.isDefault || n === 0;
    const [a] = await this.conn.db.insert(addresses).values({ ...body, isDefault, userId: user.id }).returning();
    if (isDefault) await this.setDefault(user.id, a!.id);
    return toAddressDto(a!);
  }

  async updateAddress(user: AuthUser, id: string, body: Partial<AddressBody>): Promise<AddressDto> {
    await this.ownedAddress(user, id);
    const [a] = await this.conn.db.update(addresses).set(body).where(eq(addresses.id, id)).returning();
    if (body.isDefault) await this.setDefault(user.id, id);
    return toAddressDto(a!);
  }

  async deleteAddress(user: AuthUser, id: string) {
    await this.ownedAddress(user, id);
    await this.conn.db.update(addresses).set({ deletedAt: new Date(), isDefault: false }).where(eq(addresses.id, id));
  }

  /* ------------------------------ Favoris ------------------------------ */

  async favorites(user: AuthUser): Promise<ArtisanCardDto[]> {
    const rows = await this.conn.db.select({ id: favorites.artisanId }).from(favorites).where(eq(favorites.userId, user.id)).orderBy(desc(favorites.createdAt));
    return this.catalog.cardsByIds(rows.map((r) => r.id));
  }

  async addFavorite(user: AuthUser, artisanId: string) {
    const [a] = await this.conn.db.select({ id: artisanProfiles.id }).from(artisanProfiles).where(and(eq(artisanProfiles.id, artisanId), eq(artisanProfiles.status, 'approved')));
    if (!a) throw notFound('artisan_not_found', 'Artisan introuvable.');
    await this.conn.db.insert(favorites).values({ userId: user.id, artisanId }).onConflictDoNothing();
  }

  async removeFavorite(user: AuthUser, artisanId: string) {
    await this.conn.db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.artisanId, artisanId)));
  }

  /* -------------------------- Moyens de paiement ----------------------- */

  async paymentMethods(user: AuthUser) {
    const customerId = await this.payments.ensureCustomer(user.id);
    return this.payments.provider.listPaymentMethods(customerId);
  }

  async setupIntent(user: AuthUser): Promise<SetupIntentDto> {
    const customerId = await this.payments.ensureCustomer(user.id);
    const si = await this.payments.provider.createSetupIntent({ customerId });
    return { provider: this.payments.provider.name, clientSecret: si.clientSecret, customerId, ephemeralKey: await this.payments.provider.createEphemeralKey(customerId).catch(() => null) };
  }

  async deletePaymentMethod(user: AuthUser, id: string) {
    const customerId = await this.payments.ensureCustomer(user.id);
    await this.payments.provider.detachPaymentMethod(customerId, id);
  }

  /* ------------------------------ Factures ----------------------------- */

  async invoices(user: AuthUser): Promise<InvoiceDto[]> {
    const rows = await this.conn.db.select().from(invoices).where(eq(invoices.recipientUserId, user.id)).orderBy(desc(invoices.issuedAt));
    return Promise.all(
      rows.map(async (i) => ({
        id: i.id,
        number: i.number,
        bookingId: i.bookingId,
        kind: i.kind,
        totalCents: i.totalCents,
        issuedAt: i.issuedAt.toISOString(),
        pdfUrl: await this.filesService.signedUrl(i.fileId),
      })),
    );
  }
}
