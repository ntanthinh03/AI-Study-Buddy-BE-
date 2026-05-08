import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StudySessionsService } from './study-sessions.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('study-sessions')
@UseGuards(JwtAuthGuard)
export class StudySessionsController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  @Get('daily')
  getDailySession(@Request() req: any) {
    return this.studySessionsService.getOrCreateDailySession(req.user);
  }

  @Post('mock-exam')
  generateMockExam(@Request() req: any, @Body() body: { questionCount?: number, documentId?: string }) {
    console.log('Received Mock Exam Request Body:', body);
    return this.studySessionsService.generateMockExam(req.user, body.questionCount || 20, body.documentId);
  }

  @Post(':id/submit')
  submitResult(
    @Param('id') id: string,
    @Body() result: { correctAnswers: number; totalQuestions: number },
    @Request() req: any,
  ) {
    return this.studySessionsService.submitSessionResult(req.user, id, result);
  }

  @Post('generate-batch/:documentId')
  generateBatch(@Param('documentId') documentId: string, @Request() req: any) {
    return this.studySessionsService.generateBatchForDocument(req.user, documentId);
  }

  @Get('stats')
  getStats(@Request() req: any) {
    return this.studySessionsService.getUserStats(req.user);
  }

  @Post('focus')
  submitFocus(
    @Body() body: { minutes: number },
    @Request() req: any,
  ) {
    return this.studySessionsService.submitFocusSession(req.user, body.minutes);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.studySessionsService.getLeaderboard();
  }
}
