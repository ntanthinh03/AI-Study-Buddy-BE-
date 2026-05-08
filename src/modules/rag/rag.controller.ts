import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Request,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { RagService } from './rag.service';
import type { UploadedFile as UploadedPdfFile } from '../../common/types/uploaded-file.type';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import { RAG_MESSAGES } from '../../common/constants/messages';

@Controller('rag')
@UseGuards(AuthGuard('jwt'))
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedPdfFile,
    @Body('documentId') documentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException(RAG_MESSAGES.NO_FILE_UPLOADED);
    }
    if (!documentId) {
      throw new BadRequestException('documentId is required');
    }
    return await this.ragService.processPdf(
      file.buffer,
      file.originalname,
      req.user.userId,
      documentId,
    );
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: UploadedPdfFile,
    @Body('documentId') documentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException(RAG_MESSAGES.NO_FILE_UPLOADED);
    }
    if (!documentId) {
      throw new BadRequestException('documentId is required');
    }

    const mimeType = file.mimetype ?? '';
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException(
        RAG_MESSAGES.ONLY_IMAGE_FILES_SUPPORTED_FOR_UPLOAD_IMAGE,
      );
    }

    return await this.ragService.processImage(
      file.buffer,
      file.originalname,
      mimeType,
      req.user.userId,
      documentId,
    );
  }

  @Post('ingest-text')
  async ingestText(
    @Body('text') text: string,
    @Body('source') source: string,
    @Body('documentId') documentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.ragService.saveKnowledge(
      text,
      source,
      req.user.userId,
      documentId,
    );
  }
}
