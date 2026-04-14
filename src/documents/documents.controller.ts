import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  UseGuards,
  Request,
  Delete,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { AIService } from './ai.service';
import type { UploadedFile as UploadedPdfFile } from '../common/types/uploaded-file.type';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('documents')
@UseGuards(AuthGuard('jwt'))
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedPdfFile,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.documentsService.create(file, userId);
  }

  @Get()
  async findAll(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.documentsService.findAllByUser(userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.documentsService.remove(id, userId);
  }

  @Post(':id/chat')
  async chatWithDoc(
    @Param('id') id: string,
    @Body('question') question: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;

    const doc = await this.documentsService.findOne(id, userId);

    if (!doc.contentText || doc.contentText.trim().length === 0) {
      throw new BadRequestException(
        'Tai lieu chua san sang de chat. Vui long doi xu ly xong.',
      );
    }

    const answer = await this.aiService.chatWithDocument(
      doc.contentText,
      question,
    );

    await this.documentsService.saveMessage(userId, id, question, answer);

    return { answer };
  }

  @Post(':id/history/artifact')
  async saveArtifactToHistory(
    @Param('id') id: string,
    @Body()
    body: {
      artifactType: 'QUIZ' | 'STUDY_PLAN';
      artifact: unknown;
      note?: string;
    },
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;

    if (!body?.artifactType || !body?.artifact) {
      throw new BadRequestException('artifactType and artifact are required');
    }

    await this.documentsService.findOne(id, userId);

    return await this.documentsService.saveArtifactMessage(
      userId,
      id,
      body.artifactType,
      body.artifact,
      body.note,
    );
  }

  @Post(':id/study-plan')
  async generateStudyPlan(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    const plan = await this.documentsService.createAndSaveStudyPlan(userId, id);
    return { studyPlan: plan };
  }

  @Get(':id/history')
  async getHistory(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.documentsService.getChatHistory(id, userId);
  }
}
