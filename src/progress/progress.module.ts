import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProgress } from './entities/user-progress.entity';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';


@Module({
  imports: [TypeOrmModule.forFeature([UserProgress])],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService], // ✅ Must be exported to be visible in DocumentsModule!
})
export class ProgressModule {}