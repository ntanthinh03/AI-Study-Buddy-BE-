import { Injectable } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { AIService } from '../documents/ai.service';

@Injectable()
export class QuizzesService {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService,
  ) {}

  async generateQuiz(documentId: string) {
  const document = await this.documentsService.findOne(documentId);
  
  // 1. Kiểm tra tài liệu có tồn tại không
  if (!document) {
    throw new Error('❌ Lỗi: Không tìm thấy tài liệu này trong hệ thống.');
  }

  // 2. Kiểm tra xem AI đã xử lý xong chưa
  if (document.status === 'PROCESSING') {
    throw new Error('⏳ AI đang tóm tắt tài liệu, vui lòng đợi trong giây lát...');
  }

  // 3. Kiểm tra xem có lấy được chữ không
  if (!document.contentText || document.contentText.trim().length === 0) {
    throw new Error('⚠️ Không thể đọc được nội dung từ file PDF này (có thể là file ảnh scan).');
  }

  // Nếu mọi thứ OK, gọi Gemini tạo Quiz
  return await this.aiService.generateQuiz(document.contentText);
}
}