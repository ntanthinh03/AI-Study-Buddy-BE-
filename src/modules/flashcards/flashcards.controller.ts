import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { FlashcardsService } from './flashcards.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Post('generate/:documentId')
  async generate(@Param('documentId') documentId: string, @Req() req: any) {
    return await this.flashcardsService.generateFlashcards(documentId, req.user);
  }

  @Post('generate-by-topic')
  async generateByTopic(
    @Body('documentId') documentId: string,
    @Body('topic') topic: string,
    @Req() req: any,
  ) {
    return await this.flashcardsService.generateFlashcardsByTopic(documentId, topic, req.user);
  }

  @Get()
  async findAll(@Req() req: any) {
    return await this.flashcardsService.getFlashcardsByUser(req.user);
  }

  @Get('review')
  async getToReview(@Req() req: any) {
    return await this.flashcardsService.getFlashcardsToReview(req.user);
  }

  @Patch(':id/review')
  async updateReview(
    @Param('id') id: string,
    @Body('isCorrect') isCorrect: boolean,
    @Req() req: any,
  ) {
    return await this.flashcardsService.updateReviewStatus(id, isCorrect, req.user);
  }

  @Post()
  async create(
    @Body('front') front: string,
    @Body('back') back: string,
    @Req() req: any,
  ) {
    return await this.flashcardsService.createManualFlashcard(front, back, req.user);
  }
}
