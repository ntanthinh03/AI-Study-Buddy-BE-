import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // Lấy toàn bộ lộ trình học tập của sinh viên (giống giao diện Notion)
  @Get(':userId')
async getMyProgress(@Param('userId') userId: string) {
    return await this.progressService.getMyProgress(userId);
  }


  @Get('timeline/:userId')
async getMyTimeline(@Param('userId') userId: string) {
  const data = await this.progressService.getTimeline(userId); 
  
  return data.map(item => ({
    documentId: item.document.id,
    fileName: item.document.fileName,
    status: item.isLocked ? 'LOCKED' : (item.isCompleted ? 'COMPLETED' : 'IN_PROGRESS'),
    score: item.highestScore || 0,
  }));
}
  // API này sẽ được gọi nội bộ hoặc từ App để khởi tạo lộ trình khi có bài mới
  @Post('init')
  async initProgress(@Body() data: { userId: string; documentId: string }) {
    // Logic khởi tạo bài học ở trạng thái LOCKED
    return { message: 'Đã khởi tạo lộ trình học tập' };
  }
}