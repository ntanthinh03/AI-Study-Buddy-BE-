import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashcardsService } from './flashcards.service';
import { FlashcardsController } from './flashcards.controller';
import { Flashcard } from './entities/flashcard.entity';
import { Document } from '../../documents/entities/document.entity';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flashcard, Document]),
    AnalyticsModule,
    AiModule,
    DocumentsModule,
  ],
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}

