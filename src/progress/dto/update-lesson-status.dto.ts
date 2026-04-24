import { IsIn } from 'class-validator';

export class UpdateLessonStatusDto {
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status!: 'IN_PROGRESS' | 'COMPLETED';
}
