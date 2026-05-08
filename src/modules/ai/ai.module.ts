import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AIService } from '../../common/services/ai.service';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [RagModule],
  controllers: [AiController],
  providers: [AIService],
  exports: [AIService],
})
export class AiModule {}
