import { Module } from '@nestjs/common';
import { StudyRoomsGateway } from './study-rooms.gateway';

@Module({
  providers: [StudyRoomsGateway],
})
export class StudyRoomsModule {}
