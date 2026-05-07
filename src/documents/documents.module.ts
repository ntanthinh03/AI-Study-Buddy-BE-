import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { AIService } from '../common/services/ai.service';
import { ProgressModule } from '../progress/progress.module';
import { ChatMessage } from './entities/chat-message.entity';
import { RagModule } from '../modules/rag/rag.module';
import { Conversation } from './entities/conversation.entity';
import { ConversationsController } from './conversations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, ChatMessage, Conversation]),
    ProgressModule,
    RagModule,
  ],
  controllers: [DocumentsController, ConversationsController],
  providers: [DocumentsService, AIService],
  exports: [DocumentsService, AIService],
})
export class DocumentsModule {}
