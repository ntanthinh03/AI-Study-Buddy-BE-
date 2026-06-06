import { IsIn, IsOptional, IsNumber } from 'class-validator';

export class UpdateLessonStatusDto {
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status!: 'IN_PROGRESS' | 'COMPLETED';

  @IsOptional()
  @IsNumber()
  score?: number;
}
