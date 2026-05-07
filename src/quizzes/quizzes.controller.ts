import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  Get,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('quizzes')
@UseGuards(AuthGuard('jwt'))
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post('generate/:documentId')
  async generateQuiz(
    @Param('documentId') documentId: string,
    @Body() body: { quizName?: string; quizTitle?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.quizzesService.generateQuiz(
      documentId,
      userId,
      body?.quizName,
      body?.quizTitle,
    );
  }

  @Post()
  async saveQuiz(
    @Body() createQuizDto: CreateQuizDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.quizzesService.saveFeQuiz(
      userId,
      createQuizDto.documentId,
      createQuizDto.questions,
      createQuizDto?.quizName,
      createQuizDto?.quizTitle,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.quizzesService.findAllByUser(userId);
  }
}
