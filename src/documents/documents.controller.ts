import { 
  Controller, Post, UploadedFile, UseInterceptors, 
  Get, UseGuards, Request, Delete, Param, 
  Body, BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { DocumentsService } from './documents.service';
import { AIService } from './ai.service';
import type { UploadedFile as UploadedPdfFile } from '../common/types/uploaded-file.type';

@Controller('documents')
@UseGuards(AuthGuard('jwt')) // 🔒 Đã khóa cửa toàn bộ, không cần thêm Guard lẻ ở dưới
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService, 
  ) {}

  // 1. API UPLOAD: Upload PDF và xử lý AI ngầm
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedPdfFile,
    @Request() req 
  ) {
    const userId = req.user.userId; 
    return await this.documentsService.create(file, userId);
  }

  // 2. API LẤY DANH SÁCH: Lấy tất cả file PDF của chính User đó
  @Get()
  async findAll(@Request() req) {
    const userId = req.user.userId; 
    return await this.documentsService.findAllByUser(userId);
  }

  // 3. API XÓA: Xóa tài liệu khỏi DB và folder uploads
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId;
    return await this.documentsService.remove(id, userId);
  }

  /**
   * 4. API CHATBOX: 
   * Vừa hỏi AI, vừa tự động lưu vào lịch sử để tạo "Tab" riêng biệt
   */
  @Post(':id/chat')
  async chatWithDoc(
    @Param('id') id: string,
    @Body('question') question: string,
    @Request() req
  ) {
    const userId = req.user.userId;
    
    // 1. Lấy tài liệu và kiểm tra quyền sở hữu
    const doc = await this.documentsService.findOne(id, userId);

    if (!doc.contentText || doc.contentText.trim().length === 0) {
      throw new BadRequestException('Tai lieu chua san sang de chat. Vui long doi xu ly xong.');
    }

    // 2. Gọi local AI trả lời
    const answer = await this.aiService.chatWithDocument(doc.contentText, question);

    // 3. ✅ Lưu vào DB để sau này mở Tab vẫn thấy tin nhắn cũ
    await this.documentsService.saveMessage(userId, id, question, answer);

    return { answer };
  }

  /**
   * 5. API LẤY LỊCH SỬ CHAT: 
   * Load lại tin nhắn cũ khi người dùng nhấn vào một Tab tài liệu cụ thể
   */
  @Get(':id/history')
  async getHistory(@Param('id') id: string, @Request() req) {
    const userId = req.user.userId;
    return await this.documentsService.getChatHistory(id, userId);
  }
}