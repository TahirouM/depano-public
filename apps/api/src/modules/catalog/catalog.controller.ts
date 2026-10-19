import { Controller, Get, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArtisanSearchQuery, EstimateBody, GeoPoint, SlotsQuery } from '@depano/schemas';
import { z } from 'zod';
import { OptionalAuth, Public } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody, ZQuery, parseOrThrow } from '../../common/zod';
import { CatalogService } from './catalog.service';
import { SlotsService } from './slots.service';
import { ReviewsService } from './reviews.service';

const NearQuery = z.object({ lat: z.coerce.number().min(-90).max(90).optional(), lng: z.coerce.number().min(-180).max(180).optional() });
const AddressSearchQuery = NearQuery.extend({ q: z.string().max(200).default('') });
const ReverseQuery = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).pipe(GeoPoint);
const CursorQuery = z.object({ cursor: z.string().optional() });

@ApiTags('catalogue')
@Controller()
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(SlotsService) private readonly slots: SlotsService,
    @Inject(ReviewsService) private readonly reviews: ReviewsService,
  ) {}

  @Public()
  @Get('domains')
  domains() {
    return this.catalog.domains();
  }

  @OptionalAuth()
  @Get('artisans')
  search(@ZQuery(ArtisanSearchQuery) q: z.output<typeof ArtisanSearchQuery>) {
    return this.catalog.search(q);
  }

  @OptionalAuth()
  @Get('artisans/:id')
  artisan(@IdParam() id: string, @ZQuery(NearQuery) q: z.output<typeof NearQuery>) {
    return this.catalog.publicProfile(id, q);
  }

  @OptionalAuth()
  @Get('artisans/:id/slots')
  async artisanSlots(@IdParam() id: string, @ZQuery(SlotsQuery) q: z.output<typeof SlotsQuery>) {
    await this.catalog.assertApproved(id);
    return this.slots.slots(id, q);
  }

  @OptionalAuth()
  @Get('artisans/:id/reviews')
  artisanReviews(@IdParam() id: string, @ZQuery(CursorQuery) q: z.output<typeof CursorQuery>) {
    return this.reviews.listForArtisan(id, q.cursor);
  }

  @OptionalAuth()
  @Post('estimate')
  @HttpCode(200)
  estimate(@ZBody(EstimateBody) body: z.output<typeof EstimateBody>) {
    return this.catalog.estimate(body);
  }

  @OptionalAuth()
  @Get('geo/address-search')
  addressSearch(@ZQuery(AddressSearchQuery) q: z.output<typeof AddressSearchQuery>) {
    return this.catalog.searchAddress(q.q, q);
  }

  @OptionalAuth()
  @Get('geo/reverse')
  reverse(@Query() raw: unknown) {
    const q = parseOrThrow(ReverseQuery, raw);
    return this.catalog.reverse(q.lat, q.lng);
  }
}
