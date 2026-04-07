import { Controller, Get, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(AuthGuard('jwt'))
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // Lấy toàn bộ lộ trình học tập của user hiện tại
  @Get('me')
  async getMyProgress(@Request() req) {
    const userId = req.user.userId;
    return await this.progressService.getMyProgress(userId);
  }

  @Get('timeline')
  async getMyTimeline(@Request() req) {
    const userId = req.user.userId;
    const data = await this.progressService.getTimeline(userId);

    return data.map((item) => ({
      documentId: item.document.id,
      fileName: item.document.fileName,
      status: item.isLocked
        ? 'LOCKED'
        : item.isCompleted
          ? 'COMPLETED'
          : 'IN_PROGRESS',
      score: item.highestScore || 0,
    }));
  }

  // Khởi tạo tiến độ học tập cho tài liệu mới
  @Post('init')
  async initProgress(@Body() data: { documentId: string }, @Request() req) {
    const userId = req.user.userId;
    return await this.progressService.initializeProgress(userId, data.documentId);
  }

  // Đánh dấu hoàn thành module hiện tại và mở khóa module kế tiếp
  @Post('complete')
  async completeModule(
    @Body() data: { documentId: string; score: number },
    @Request() req,
  ) {
    const userId = req.user.userId;
    return await this.progressService.unlockNextModule(
      userId,
      data.documentId,
      data.score,
    );
  }
}