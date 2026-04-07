import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm'; // ✅ Thêm import này
import { Repository } from 'typeorm';                // ✅ Thêm import này
import { Quiz } from './entities/quiz.entity';
import { DocumentsService } from '../documents/documents.service';
import { AIService } from '../documents/ai.service';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz) 
    private quizzesRepository: Repository<Quiz>,
    private readonly documentsService: DocumentsService,
    private readonly aiService: AIService,
  ) {}

  async generateQuiz(documentId: string, userId: string) {
  const document = await this.documentsService.findOne(documentId, userId);
  
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

  // Nếu mọi thứ OK, gọi local AI tạo Quiz
  return await this.aiService.generateQuiz(document.contentText);
}
async saveQuiz(questions: any, documentId: string, userId: string) {
  const quiz = this.quizzesRepository.create({
    questions,
    document: { id: documentId },
    user: { id: userId } // Gán ID người dùng để biết quiz này của ai
  });
  return await this.quizzesRepository.save(quiz);
}
async findAllByUser(userId: string) {
  return await this.quizzesRepository.find({
    where: { user: { id: userId } },
    relations: ['document'], // 📄 Lấy kèm thông tin file PDF liên quan
    order: { createdAt: 'DESC' },
  });
}
}