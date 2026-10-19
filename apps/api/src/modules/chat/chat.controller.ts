import { Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SendMessageBody } from '@depano/schemas';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { IdParam } from '../../common/params';
import { ZBody, ZQuery } from '../../common/zod';
import { ChatService } from './chat.service';

const BeforeQuery = z.object({ before: z.string().optional() });

@ApiTags('messagerie')
@ApiBearerAuth()
@Controller('conversations')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chat: ChatService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.chat.listConversations(user.id);
  }

  @Get(':id/messages')
  messages(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZQuery(BeforeQuery) q: z.output<typeof BeforeQuery>) {
    return this.chat.listMessages(user.id, id, q.before);
  }

  @Post(':id/messages')
  send(@CurrentUser() user: AuthUser, @IdParam() id: string, @ZBody(SendMessageBody) body: z.output<typeof SendMessageBody>) {
    return this.chat.send(user.id, id, body);
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @IdParam() id: string) {
    await this.chat.markRead(user.id, id);
  }
}
