import {
  Controller,
  Delete,
  Get,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('conversations')
@UseGuards(AuthGuard('jwt'))
export class ConversationsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async getMyConversations(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.documentsService.getConversationsByUser(userId);
  }

  @Get(':conversationId/messages')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.documentsService.getConversationMessages(
      userId,
      conversationId,
    );
  }

  @Delete(':conversationId')
  async deleteConversation(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.documentsService.removeConversation(userId, conversationId);
  }
}
