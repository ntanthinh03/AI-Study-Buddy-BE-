import { Controller, Post, UploadedFile, UseInterceptors, Body, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // API Upload đã có
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('userId') userId: string) {
    const id = userId || 'thinh';
    return await this.documentsService.create(file, id);
  }

  // ✅ THÊM ĐOẠN NÀY: Để xử lý GET http://localhost:3001/documents
  @Get()
  async findAll() {
    return await this.documentsService.findAll();
  }
}