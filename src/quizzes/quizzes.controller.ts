import { Controller, Post, Param, UseGuards, Request, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // ✅ Bảo vệ API bằng JWT
import { QuizzesService } from './quizzes.service';

@Controller('quizzes')
@UseGuards(AuthGuard('jwt')) // 🔒 Chỉ những ai đã đăng nhập mới được "xài" local AI tạo Quiz
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  /**
   * API tạo Quiz từ DocumentId
   * URL: POST http://localhost:3001/quizzes/generate/:documentId
   */
  @Post('generate/:documentId')
  async generateQuiz(
    @Param('documentId') documentId: string,
    @Request() req // 👈 Lấy thông tin user từ Token
  ) {
    // Trích xuất userId từ payload của JWT
    const userId = req.user.userId;

    // Truyền cả 2 tham số: ID tài liệu và ID chủ sở hữu
    // Điều này giúp QuizzesService gọi DocumentsService.findOne(documentId, userId) mà không bị lỗi
    return await this.quizzesService.generateQuiz(documentId, userId);
  }
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(@Request() req) {
    const userId = req.user.userId;
    return await this.quizzesService.findAllByUser(userId);
}
}