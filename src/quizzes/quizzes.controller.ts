import { Controller, Post, Param } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';

@Controller('quizzes') // Khai báo tiền tố /quizzes
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  // API tạo Quiz: Khớp với http://localhost:3001/quizzes/generate/:documentId
  @Post('generate/:documentId')
  async generateQuiz(@Param('documentId') documentId: string) {
    // Gọi sang service để AI Gemini bắt đầu tạo câu hỏi
    return await this.quizzesService.generateQuiz(documentId);
  }
}