import { Module } from '@nestjs/common';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { DocumentsModule } from '../documents/documents.module'; // Nhập DocumentsModule để dùng DocumentsService

@Module({
  imports: [
    DocumentsModule, // ✅ Cần thiết vì QuizzesService phụ thuộc vào DocumentsService
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService], // ✅ ĐĂNG KÝ SERVICE Ở ĐÂY để hết lỗi
})
export class QuizzesModule {}