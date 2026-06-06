import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProgressService } from './progress.service';
import { SaveLessonDto } from './dto/save-lesson.dto';
import { SaveLessonQuizDto } from './dto/save-lesson-quiz.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('progress')
@UseGuards(AuthGuard('jwt'))
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post('lessons')
  async saveLesson(
    @Body() dto: SaveLessonDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.saveLesson(userId, dto);
  }

  @Get('lessons')
  async getMyLessons(
    @Query('conversationId') conversationId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.getMyLessons(userId, conversationId);
  }

  @Post('lessons/:lessonId/status')
  async updateLessonStatus(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonStatusDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.updateLessonStatus(
      userId,
      lessonId,
      dto.status,
      dto.score,
    );
  }

  @Get('lessons/:lessonId')
  async getLessonDetail(
    @Param('lessonId') lessonId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.getLessonById(userId, lessonId);
  }

  @Get('timeline')
  async getProgressTimeline(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.progressService.getProgressTimeline(userId);
  }

  @Post('init')
  async initProgress(
    @Body() dto: { documentId: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.initProgress(userId, dto.documentId);
  }

  @Post('complete')
  async completeProgress(
    @Body() dto: { documentId: string; score: number },
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.progressService.completeProgress(userId, dto.documentId, dto.score);
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
