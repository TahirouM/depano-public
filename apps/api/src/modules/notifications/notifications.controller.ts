import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZQuery } from '../../common/zod';
import { NotificationsService } from './notifications.service';

const CursorQuery = z.object({ cursor: z.string().optional() });

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @ZQuery(CursorQuery) q: z.output<typeof CursorQuery>) {
    return this.notifications.list(user.id, q.cursor);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    await this.notifications.markRead(user.id, id);
  }
}
