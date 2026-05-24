import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MindMap } from './entities/mind-map.entity';
import { Document } from '../../documents/entities/document.entity';
import { MindMapsService } from './mind-maps.service';
import { MindMapsController } from './mind-maps.controller';
import { AiModule } from '../ai/ai.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MindMap, Document]),
    AnalyticsModule,
    AiModule, 
  ],
  providers: [MindMapsService],
  controllers: [MindMapsController],
  exports: [MindMapsService],
})
export class MindMapsModule {}
