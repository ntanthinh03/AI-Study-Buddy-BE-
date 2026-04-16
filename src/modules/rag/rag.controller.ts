import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';
import type { UploadedFile as UploadedPdfFile } from '../../common/types/uploaded-file.type';
import { RAG_MESSAGES } from '../../common/constants/messages';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: UploadedPdfFile) {
    if (!file) {
      throw new BadRequestException(RAG_MESSAGES.NO_FILE_UPLOADED);
    }
    return await this.ragService.processPdf(file.buffer, file.originalname);
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: UploadedPdfFile) {
    if (!file) {
      throw new BadRequestException(RAG_MESSAGES.NO_FILE_UPLOADED);
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
    );
  }

  @Post('ingest-text')
  async ingestText(@Body('text') text: string, @Body('source') source: string) {
    return await this.ragService.saveKnowledge(text, source);
  }
}
