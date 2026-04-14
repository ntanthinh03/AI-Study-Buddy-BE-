import {
  Controller,
  Post,
  Param,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QuizzesService } from './quizzes.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('quizzes')
@UseGuards(AuthGuard('jwt'))
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post('generate/:documentId')
  async generateQuiz(
    @Param('documentId') documentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return await this.quizzesService.generateQuiz(documentId, userId);
  }
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll(@Request() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return await this.quizzesService.findAllByUser(userId);
  }
}
