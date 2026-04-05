import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { error: "No file uploaded" };
    return await this.ragService.processPdf(file.buffer, file.originalname);
  }

  @Post('ingest-text')
    async ingestText(
    @Body('text') text: string, 
    @Body('source') source: string) {
    return await this.ragService.saveKnowledge(text, source);
}
}