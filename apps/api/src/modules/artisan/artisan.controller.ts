import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArtisanDocumentBody,
  ArtisanProfileBody,
  ArtisanServicesBody,
  AvailabilityExceptionBody,
  AvailabilityRulesBody,
  CustomServiceBody,
  PlanningQuery,
  SiretLookupBody,
  UrgentAvailabilityBody,
} from '@depano/schemas';
import { z } from 'zod';
import { ArtisanOnly, CurrentArtisan, CurrentUser, type ArtisanContext, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody, ZQuery } from '../../common/zod';
import { ArtisanService } from './artisan.service';
import { PromotionService } from './promotion.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { ReviewsService } from '../catalog/reviews.service';

const CursorQuery = z.object({ cursor: z.string().optional() });

@ApiTags('artisan')
@ApiBearerAuth()
@Controller('artisan')
export class ArtisanController {
  constructor(
    @Inject(ArtisanService) private readonly artisans: ArtisanService,
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
    @Inject(PromotionService) private readonly promotion: PromotionService,
  ) {}

  /** Accessible à tout utilisateur connecté : crée le brouillon de profil artisan. */
  @Post('onboarding/siret')
  @HttpCode(200)
  siret(@CurrentUser() user: AuthUser, @ZBody(SiretLookupBody) body: z.output<typeof SiretLookupBody>) {
    return this.artisans.lookupSiret(user.id, body.siret);
  }

  @ArtisanOnly()
  @Get('profile')
  profile(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.profile(a.id);
  }

  @ArtisanOnly()
  @Patch('profile')
  updateProfile(@CurrentArtisan() a: ArtisanContext, @ZBody(ArtisanProfileBody) body: z.output<typeof ArtisanProfileBody>) {
    return this.artisans.updateProfile(a, body);
  }

  @ArtisanOnly()
  @Put('services')
  setServices(@CurrentArtisan() a: ArtisanContext, @ZBody(ArtisanServicesBody) body: z.output<typeof ArtisanServicesBody>) {
    return this.artisans.setServices(a, body);
  }

  /** Motif personnel (« + » de l'écran Tarifs) : créé actif, réservé à cet artisan. */
  @ArtisanOnly()
  @Post('services/custom')
  addCustomService(@CurrentArtisan() a: ArtisanContext, @ZBody(CustomServiceBody) body: z.output<typeof CustomServiceBody>) {
    return this.artisans.addCustomService(a, body);
  }

  @ArtisanOnly()
  @Delete('services/custom/:serviceId')
  deleteCustomService(@CurrentArtisan() a: ArtisanContext, @IdParam('serviceId') serviceId: string) {
    return this.artisans.deleteCustomService(a, serviceId);
  }

  @ArtisanOnly()
  @Put('availability/rules')
  setRules(@CurrentArtisan() a: ArtisanContext, @ZBody(AvailabilityRulesBody) body: z.output<typeof AvailabilityRulesBody>) {
    return this.artisans.setAvailabilityRules(a, body);
  }

  @ArtisanOnly()
  @Get('availability/exceptions')
  exceptions(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.exceptions(a);
  }

  @ArtisanOnly()
  @Post('availability/exceptions')
  addException(@CurrentArtisan() a: ArtisanContext, @ZBody(AvailabilityExceptionBody) body: z.output<typeof AvailabilityExceptionBody>) {
    return this.artisans.addException(a, body);
  }

  @ArtisanOnly()
  @Delete('availability/exceptions/:id')
  @HttpCode(204)
  async deleteException(@CurrentArtisan() a: ArtisanContext, @IdParam() id: string) {
    await this.artisans.deleteException(a, id);
  }

  @ArtisanOnly()
  @Post('documents')
  addDocument(@CurrentArtisan() a: ArtisanContext, @ZBody(ArtisanDocumentBody) body: z.output<typeof ArtisanDocumentBody>) {
    return this.artisans.addDocument(a, body);
  }

  @ArtisanOnly()
  @Post('payouts/onboarding-link')
  @HttpCode(200)
  onboardingLink(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.payoutOnboardingLink(a);
  }

  @ArtisanOnly()
  @Post('submit')
  @HttpCode(200)
  submit(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.submit(a);
  }

  @ArtisanOnly({ approved: true })
  @Put('urgent-availability')
  urgent(@CurrentArtisan() a: ArtisanContext, @ZBody(UrgentAvailabilityBody) body: z.output<typeof UrgentAvailabilityBody>) {
    return this.artisans.setUrgentAvailability(a, body);
  }

  @ArtisanOnly()
  @Get('dashboard')
  dashboard(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.dashboard(a);
  }

  @ArtisanOnly()
  @Get('planning')
  planning(@CurrentArtisan() a: ArtisanContext, @ZQuery(PlanningQuery) q: z.output<typeof PlanningQuery>) {
    return this.artisans.planning(a, new Date(q.from), new Date(q.to));
  }

  @ArtisanOnly({ approved: true })
  @Get('offers')
  offers(@CurrentArtisan() a: ArtisanContext) {
    return this.dispatch.pendingOffers(a.id);
  }

  @ArtisanOnly({ approved: true })
  @Get('offers/:id')
  offer(@CurrentArtisan() a: ArtisanContext, @IdParam() id: string) {
    return this.dispatch.getOffer(a.id, id);
  }

  @ArtisanOnly({ approved: true })
  @Post('offers/:id/accept')
  @HttpCode(200)
  accept(@CurrentArtisan() a: ArtisanContext, @IdParam() id: string) {
    return this.dispatch.accept(a, id);
  }

  @ArtisanOnly({ approved: true })
  @Post('offers/:id/decline')
  @HttpCode(204)
  async decline(@CurrentArtisan() a: ArtisanContext, @IdParam() id: string) {
    await this.dispatch.decline(a, id);
  }

  @ArtisanOnly()
  @Get('earnings')
  earnings(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.earnings(a);
  }

  @ArtisanOnly()
  @Get('stats')
  stats(@CurrentArtisan() a: ArtisanContext) {
    return this.artisans.stats(a);
  }

  @ArtisanOnly()
  @Get('promotion')
  promotionStatus(@CurrentArtisan() a: ArtisanContext) {
    return this.promotion.get(a.id);
  }

  @ArtisanOnly({ approved: true })
  @Post('promotion/subscribe')
  @HttpCode(200)
  subscribePromotion(@CurrentArtisan() a: ArtisanContext) {
    return this.promotion.subscribe(a);
  }

  @ArtisanOnly()
  @Post('promotion/cancel')
  @HttpCode(200)
  cancelPromotion(@CurrentArtisan() a: ArtisanContext) {
    return this.promotion.cancel(a);
  }

  @ArtisanOnly()
  @Get('reviews')
  myReviews(@CurrentArtisan() a: ArtisanContext, @ZQuery(CursorQuery) q: z.output<typeof CursorQuery>) {
    return this.reviews.listForArtisan(a.id, q.cursor);
  }
}
