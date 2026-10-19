import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UploadUrlBody } from '@depano/schemas';
import type { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody } from '../../common/zod';
import { RateLimiter } from '../../infra/redis';
import { FilesService } from './files.service';

@ApiTags('fichiers')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  @Post('upload-url')
  @HttpCode(200)
  async uploadUrl(@CurrentUser() user: AuthUser, @ZBody(UploadUrlBody) body: z.output<typeof UploadUrlBody>) {
    await this.limiter.hit(`upload:${user.id}`, 120, 3600, 'Trop de fichiers envoyés, réessayez plus tard.');
    return this.files.createUpload(user, body);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.files.complete(user, id);
  }

  @Get(':id/url')
  url(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    return this.files.url(user, id);
  }
}
