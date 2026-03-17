import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { AIService } from './ai.service';
import { ProgressModule } from '../progress/progress.module'; // ✅ 1. Import the ProgressModule
import { ChatMessage } from './entities/chat-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, ChatMessage]), // Already there
    ProgressModule, // ✅ 2. Add ProgressModule here to resolve dependencies
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, AIService],
  exports: [DocumentsService, AIService],
})
export class DocumentsModule {}