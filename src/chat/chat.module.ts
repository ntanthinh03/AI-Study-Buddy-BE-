import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DocumentsModule } from '../documents/documents.module';
import { RagModule } from '../modules/rag/rag.module';

@Module({
  imports: [DocumentsModule, RagModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
