import {
  Body,
  Get,
  UploadedFile,
  Controller,
  Param,
  Post,
  Request,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { DocumentsService } from '../documents/documents.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import type { UploadedFile as UploadedChatImage } from '../common/types/uploaded-file.type';
import { CHAT_MESSAGES } from '../common/constants/messages';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Post('ask')
  async askAI(
    @Body()
    body: {
      message: string;
      conversationId?: string;
      title?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    if (!body?.message || body.message.trim().length === 0) {
      throw new BadRequestException(CHAT_MESSAGES.MESSAGE_REQUIRED);
    }

    const answer = await this.chatService.getAIResponse(body.message);
    return await this.documentsService.saveGeneralMessage(
      req.user.userId,
      body.message,
      answer,
      body.conversationId,
      body.title,
    );
  }

  @Post('ask-image')
  @UseInterceptors(FileInterceptor('image'))
  async askAIWithImage(
    @UploadedFile() file: UploadedChatImage,
    @Body()
    body: {
      question?: string;
      message?: string;
      conversationId?: string;
      title?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(CHAT_MESSAGES.IMAGE_REQUIRED);
    }

    const mimeType = file.mimetype ?? '';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(CHAT_MESSAGES.ONLY_IMAGE_FILES_SUPPORTED);
    }

    const question = (body.question ?? body.message ?? '').trim();
    if (!question) {
      throw new BadRequestException(CHAT_MESSAGES.QUESTION_REQUIRED);
    }

    const answer = await this.chatService.getAIImageResponse(
      question,
      file.buffer,
      mimeType,
    );

    return await this.documentsService.saveGeneralMessage(
      req.user.userId,
      question,
      answer,
      body.conversationId,
      body.title,
      {
        data: file.buffer,
        mimeType,
        originalName: file.originalname ?? 'image',
      },
    );
  }

  @Get('messages/:messageId/image')
  async getMessageImage(
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.documentsService.getGeneralMessageImage(
      req.user.userId,
      messageId,
    );
  }
}
