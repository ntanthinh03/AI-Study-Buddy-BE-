import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RagModule } from '../rag/rag.module'; // Import Module chứa RagService

@Module({
  imports: [RagModule], // Đưa RagModule vào đây
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}