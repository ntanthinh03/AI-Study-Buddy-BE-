import { Module } from '@nestjs/common';
import { QuizzesController } from './quizzes.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizzesService } from './quizzes.service';
import { DocumentsModule } from '../documents/documents.module';
import { Quiz } from './entities/quiz.entity';
import { AnalyticsModule } from '../modules/analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz]),
    DocumentsModule,
    AnalyticsModule,
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
})
export class QuizzesModule {}
