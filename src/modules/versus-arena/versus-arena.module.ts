import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VersusMatch } from './entities/versus-match.entity';
import { VersusArenaService } from './versus-arena.service';
import { VersusArenaController } from './versus-arena.controller';
import { Document } from '../../documents/entities/document.entity';
import { UserStats } from '../../users/entities/user-stats.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VersusMatch, Document, UserStats]),
    AiModule,
  ],
  controllers: [VersusArenaController],
  providers: [VersusArenaService],
  exports: [VersusArenaService],
})
export class VersusArenaModule {}
