import { Controller, Get, HttpCode, Inject, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AnswerQuoteBody,
  ArtisanNoteBody,
  BookingListQuery,
  CancelBookingBody,
  CompleteBody,
  CreateBookingBody,
  CreateQuoteBody,
  DisputeBody,
  LocationBody,
  NotFeasibleBody,
  ReportBody,
  RespondRequestBody,
  ReviewBody,
  ReviewReplyBody,
  TransitionBody,
} from '@depano/schemas';
import type { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody, ZQuery } from '../../common/zod';
import { BookingsService } from './bookings.service';
import { ReviewsService } from '../catalog/reviews.service';

@ApiTags('interventions')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @ZBody(CreateBookingBody) body: z.output<typeof CreateBookingBody>) {
    return this.bookings.create(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @ZQuery(BookingListQuery) q: z.output<typeof BookingListQuery>) {
    return this.bookings.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.bookings.get(user, id);
  }

  @Post(':id/confirm-payment')
  @HttpCode(200)
  confirmPayment(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.bookings.confirmPaymentDetail(user, id);
  }

  @Post(':id/payment-session')
  @HttpCode(200)
  paymentSession(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.bookings.paymentSession(user, id);
  }

  @Post(':id/respond')
  @HttpCode(200)
  respond(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(RespondRequestBody) body: z.output<typeof RespondRequestBody>) {
    return this.bookings.respond(user, id, body);
  }

  @Post(':id/not-feasible')
  @HttpCode(200)
  notFeasible(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(NotFeasibleBody) body: z.output<typeof NotFeasibleBody>) {
    return this.bookings.notFeasible(user, id, body);
  }

  @Put(':id/artisan-note')
  artisanNote(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ArtisanNoteBody) body: z.output<typeof ArtisanNoteBody>) {
    return this.bookings.setArtisanNote(user, id, body);
  }

  @Post(':id/transition')
  @HttpCode(200)
  transition(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(TransitionBody) body: z.output<typeof TransitionBody>) {
    return this.bookings.requestTransition(user, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(CancelBookingBody) body: z.output<typeof CancelBookingBody>) {
    return this.bookings.cancel(user, id, body);
  }

  @Post(':id/quote')
  @HttpCode(200)
  quote(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(CreateQuoteBody) body: z.output<typeof CreateQuoteBody>) {
    return this.bookings.sendQuote(user, id, body);
  }

  @Post(':id/quote/answer')
  @HttpCode(200)
  answerQuote(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(AnswerQuoteBody) body: z.output<typeof AnswerQuoteBody>) {
    return this.bookings.answerQuote(user, id, body);
  }

  @Post(':id/report')
  @HttpCode(200)
  report(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ReportBody) body: z.output<typeof ReportBody>) {
    return this.bookings.report(user, id, body);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(CompleteBody) body: z.output<typeof CompleteBody>) {
    return this.bookings.complete(user, id, body.code);
  }

  @Post(':id/location')
  @HttpCode(204)
  async location(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(LocationBody) body: z.output<typeof LocationBody>) {
    await this.bookings.updateLocation(user, id, body);
  }

  @Post(':id/review')
  review(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ReviewBody) body: z.output<typeof ReviewBody>) {
    return this.bookings.review(user, id, body);
  }

  @Post(':id/dispute')
  @HttpCode(200)
  dispute(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(DisputeBody) body: z.output<typeof DisputeBody>) {
    return this.bookings.dispute(user, id, body);
  }

  @Post(':id/call')
  @HttpCode(200)
  call(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.bookings.callRelay(user, id);
  }
}

@ApiTags('avis')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Post(':id/reply')
  @HttpCode(200)
  reply(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(ReviewReplyBody) body: z.output<typeof ReviewReplyBody>) {
    return this.reviews.reply(user.id, id, body.body);
  }
}
