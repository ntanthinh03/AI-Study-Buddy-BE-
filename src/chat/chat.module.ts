// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service'; // 👈 Nhớ import nó vào nhé

@Module({
  controllers: [ChatController],
  providers: [ChatService], // 🚀 "Đăng ký" Service ở đây để Controller có thể dùng
})
export class ChatModule {}