import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudySessionsService } from './study-sessions.service';
import { StudySessionsController } from './study-sessions.controller';
import { StudySession } from './entities/study-session.entity';
import { QuestionPool } from './entities/question-pool.entity';
import { UserStats } from '../../users/entities/user-stats.entity';
import { Document } from '../../documents/entities/document.entity';
import { Flashcard } from '../flashcards/entities/flashcard.entity';
import { User } from '../../users/entities/user.entity';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StudySession, QuestionPool, UserStats, Document, Flashcard, User]),
    AiModule,
    AnalyticsModule,
  ],
  controllers: [StudySessionsController],
  providers: [StudySessionsService],
  exports: [StudySessionsService],
})
export class StudySessionsModule {}
