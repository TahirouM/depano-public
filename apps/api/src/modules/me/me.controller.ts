import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddressBody, ApplyReferralBody, NotificationPrefsBody, PushTokenBody, SetActiveRoleBody, UpdateMeBody } from '@depano/schemas';
import type { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody } from '../../common/zod';
import { MeService } from './me.service';
import { ReferralService } from './referral.service';

const AddressPatch = AddressBody.partial();

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    @Inject(MeService) private readonly me: MeService,
    @Inject(ReferralService) private readonly referral: ReferralService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.me.toMe(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @ZBody(UpdateMeBody) body: z.output<typeof UpdateMeBody>) {
    return this.me.update(user, body);
  }

  @Put('active-role')
  setActiveRole(@CurrentUser() user: AuthUser, @ZBody(SetActiveRoleBody) body: z.output<typeof SetActiveRoleBody>) {
    return this.me.setActiveRole(user, body);
  }

  @Delete()
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthUser) {
    await this.me.delete(user);
  }

  @Get('export')
  exportData(@CurrentUser() user: AuthUser) {
    return this.me.exportData(user);
  }

  @Get('badges')
  badges(@CurrentUser() user: AuthUser) {
    return this.me.badges(user);
  }

  @Post('push-tokens')
  @HttpCode(204)
  async pushToken(@CurrentUser() user: AuthUser, @ZBody(PushTokenBody) body: z.output<typeof PushTokenBody>) {
    await this.me.registerPushToken(user, body);
  }

  @Delete('push-tokens/:token')
  @HttpCode(204)
  async unregisterPushToken(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    await this.me.unregisterPushToken(user, token);
  }

  @Get('notification-preferences')
  notificationPrefs(@CurrentUser() user: AuthUser) {
    return this.me.notificationPrefs(user);
  }

  @Put('notification-preferences')
  updateNotificationPrefs(@CurrentUser() user: AuthUser, @ZBody(NotificationPrefsBody) body: z.output<typeof NotificationPrefsBody>) {
    return this.me.updateNotificationPrefs(user, body);
  }

  @Get('addresses')
  addresses(@CurrentUser() user: AuthUser) {
    return this.me.addresses(user);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: AuthUser, @ZBody(AddressBody) body: z.output<typeof AddressBody>) {
    return this.me.createAddress(user, body);
  }

  @Patch('addresses/:id')
  updateAddress(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(AddressPatch) body: z.output<typeof AddressPatch>) {
    return this.me.updateAddress(user, id, body);
  }

  @Delete('addresses/:id')
  @HttpCode(204)
  async deleteAddress(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    await this.me.deleteAddress(user, id);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthUser) {
    return this.me.favorites(user);
  }

  @Put('favorites/:artisanId')
  @HttpCode(204)
  async addFavorite(@CurrentUser() user: AuthUser, @IdParam('artisanId') id: string) {
    await this.me.addFavorite(user, id);
  }

  @Delete('favorites/:artisanId')
  @HttpCode(204)
  async removeFavorite(@CurrentUser() user: AuthUser, @IdParam('artisanId') id: string) {
    await this.me.removeFavorite(user, id);
  }

  @Get('payment-methods')
  paymentMethods(@CurrentUser() user: AuthUser) {
    return this.me.paymentMethods(user);
  }

  @Post('payment-methods/setup-intent')
  @HttpCode(200)
  setupIntent(@CurrentUser() user: AuthUser) {
    return this.me.setupIntent(user);
  }

  @Delete('payment-methods/:id')
  @HttpCode(204)
  async deletePaymentMethod(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.me.deletePaymentMethod(user, id);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: AuthUser) {
    return this.me.invoices(user);
  }

  @Get('referral')
  referralInfo(@CurrentUser() user: AuthUser) {
    return this.referral.get(user.id);
  }

  @Post('referral/apply')
  @HttpCode(200)
  applyReferral(@CurrentUser() user: AuthUser, @ZBody(ApplyReferralBody) body: z.output<typeof ApplyReferralBody>) {
    return this.referral.apply(user.id, body.code);
  }
}
