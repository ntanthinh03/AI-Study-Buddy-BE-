import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';
import { SaveLessonDto } from './dto/save-lesson.dto';
import { SaveLessonQuizDto } from './dto/save-lesson-quiz.dto';
import { InitProgressDto } from './dto/init-progress.dto';
import { CompleteProgressDto } from './dto/complete-progress.dto';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('progress')
@UseGuards(AuthGuard('jwt'))
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('me')
  async getMyProgress(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.progressService.getMyProgress(userId);
  }

  @Get('timeline')
  async getMyTimeline(@Request() req: AuthenticatedRequest) {
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

  @Post('init')
  async initProgress(
    @Body() data: InitProgressDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.initializeProgress(
      userId,
      data.documentId,
    );
  }

  @Post('complete')
  async completeModule(
    @Body() data: CompleteProgressDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.unlockNextModule(
      userId,
      data.documentId,
      data.score,
    );
  }

  @Post('lessons')
  async saveLesson(
    @Body() dto: SaveLessonDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.saveLesson(userId, dto);
  }

  @Get('lessons')
  async getMyLessons(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.progressService.getMyLessons(userId);
  }

  @Get('lessons/:lessonId')
  async getLessonDetail(
    @Param('lessonId') lessonId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.getLessonById(userId, lessonId);
  }

  @Post('lessons/:lessonId/quiz')
  async saveLessonQuiz(
    @Param('lessonId') lessonId: string,
    @Body() dto: SaveLessonQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.saveLessonQuiz(
      userId,
      lessonId,
      dto.quiz,
    );
  }
}
