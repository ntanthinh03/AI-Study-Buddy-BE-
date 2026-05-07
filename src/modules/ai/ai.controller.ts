import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AIService } from '../../common/services/ai.service';
import { CHAT_MESSAGES } from '../../common/constants/messages';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AIService) {}

  @Post('ask')
  async ask(@Body('question') question: string) {
    if (!question || question.trim().length === 0) {
      throw new BadRequestException(CHAT_MESSAGES.QUESTION_REQUIRED);
    }
    return await this.aiService.generateRagResponse(question);
  }
}
