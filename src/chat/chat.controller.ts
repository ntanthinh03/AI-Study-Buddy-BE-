import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  async askAI(@Body() body: { message: string }) {
    const answer = await this.chatService.getAIResponse(body.message);
    return { answer };
  }
}
