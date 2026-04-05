import { Module } from '@nestjs/common';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService], // Bắt buộc phải có để Module khác sử dụng được
})
export class RagModule {}