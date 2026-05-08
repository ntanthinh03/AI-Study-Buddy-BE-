import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProgress } from './entities/user-progress.entity';
import { LearningLesson } from './entities/learning-lesson.entity';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { Conversation } from '../documents/entities/conversation.entity';
import { Document } from '../documents/entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProgress, LearningLesson, Conversation, Document]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
