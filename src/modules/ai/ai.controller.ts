import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  async ask(@Body('question') question: string) {
    if (!question) return { error: "Question is required" };
    return await this.aiService.generateResponse(question);
  }
}