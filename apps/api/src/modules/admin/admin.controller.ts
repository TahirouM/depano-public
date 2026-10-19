import { Controller, Get, HttpCode, Inject, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AdminArtisanListQuery,
  AdminBookingListQuery,
  AdminDecisionBody,
  AdminServiceBody,
  ResolveDisputeBody,
  ZoneBody,
} from '@depano/schemas';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody, ZQuery } from '../../common/zod';
import { AdminService } from './admin.service';

const PeriodQuery = z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() });
const DisputeListQuery = z.object({ status: z.enum(['open', 'resolved']).optional() });
const UsersQuery = z.object({ q: z.string().max(100).optional(), cursor: z.string().optional() });
const Dac7Query = z.object({ year: z.coerce.number().int().min(2023).max(2100) });
const ServicePatch = AdminServiceBody.partial();
const ZonePatch = ZoneBody.partial();

/**
 * Back-office. Support : lecture des interventions, litiges (et arbitrage), utilisateurs, artisans.
 * Admin : tout, dont validation des artisans, catalogue, zones, indicateurs et export DAC7.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('support', 'admin')
@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Roles('admin')
  @Get('metrics')
  metrics(@ZQuery(PeriodQuery) q: z.output<typeof PeriodQuery>) {
    return this.admin.metrics(q.from, q.to);
  }

  @Get('artisans')
  artisans(@ZQuery(AdminArtisanListQuery) q: z.output<typeof AdminArtisanListQuery>) {
    return this.admin.artisansList(q);
  }

  @Get('artisans/:id')
  artisan(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.admin.artisanDetail(id, user.id);
  }

  @Roles('admin')
  @Post('artisans/:id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.admin.approveArtisan(user, id);
  }

  @Roles('admin')
  @Post('artisans/:id/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(AdminDecisionBody) body: z.output<typeof AdminDecisionBody>) {
    return this.admin.rejectArtisan(user, id, body.reason);
  }

  @Roles('admin')
  @Post('artisans/:id/suspend')
  @HttpCode(200)
  suspend(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(AdminDecisionBody) body: z.output<typeof AdminDecisionBody>) {
    return this.admin.suspendArtisan(user, id, body.reason);
  }

  @Roles('admin')
  @Post('artisans/:id/reinstate')
  @HttpCode(200)
  reinstate(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.admin.reinstateArtisan(user, id);
  }

  @Roles('admin')
  @Post('documents/:id/approve')
  @HttpCode(200)
  approveDocument(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.admin.reviewDocument(user, id, true);
  }

  @Roles('admin')
  @Post('documents/:id/reject')
  @HttpCode(200)
  rejectDocument(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(AdminDecisionBody) body: z.output<typeof AdminDecisionBody>) {
    return this.admin.reviewDocument(user, id, false, body.reason);
  }

  @Get('bookings')
  bookings(@CurrentUser() user: AuthUser, @ZQuery(AdminBookingListQuery) q: z.output<typeof AdminBookingListQuery>) {
    return this.admin.bookingsList(q, user.id);
  }

  @Get('bookings/:id')
  booking(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.admin.bookingDetail(id, user.id);
  }

  @Get('disputes')
  disputes(@ZQuery(DisputeListQuery) q: z.output<typeof DisputeListQuery>) {
    return this.admin.disputesList(q.status);
  }

  @Post('disputes/:id/resolve')
  @HttpCode(200)
  resolve(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ResolveDisputeBody) body: z.output<typeof ResolveDisputeBody>) {
    return this.admin.resolveDispute(user, id, body);
  }

  @Roles('admin')
  @Get('services')
  services() {
    return this.admin.servicesList();
  }

  @Roles('admin')
  @Post('services')
  createService(@CurrentUser() user: AuthUser, @ZBody(AdminServiceBody) body: z.output<typeof AdminServiceBody>) {
    return this.admin.createService(user, body);
  }

  @Roles('admin')
  @Patch('services/:id')
  updateService(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ServicePatch) body: z.output<typeof ServicePatch>) {
    return this.admin.updateService(user, id, body);
  }

  @Roles('admin')
  @Get('zones')
  zones() {
    return this.admin.zonesList();
  }

  @Roles('admin')
  @Post('zones')
  createZone(@CurrentUser() user: AuthUser, @ZBody(ZoneBody) body: z.output<typeof ZoneBody>) {
    return this.admin.createZone(user, body);
  }

  @Roles('admin')
  @Patch('zones/:id')
  updateZone(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ZonePatch) body: z.output<typeof ZonePatch>) {
    return this.admin.updateZone(user, id, body);
  }

  @Get('users')
  users(@ZQuery(UsersQuery) q: z.output<typeof UsersQuery>) {
    return this.admin.usersList(q.q, q.cursor);
  }

  @Roles('admin')
  @Get('exports/dac7')
  dac7(@CurrentUser() user: AuthUser, @ZQuery(Dac7Query) q: z.output<typeof Dac7Query>) {
    return this.admin.dac7Export(user, q.year);
  }
}
