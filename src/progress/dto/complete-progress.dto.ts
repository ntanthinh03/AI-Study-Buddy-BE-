import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class CompleteProgressDto {
  @IsUUID('4', { message: 'documentId must be a valid UUID.' })
  documentId!: string;

  @IsNumber({}, { message: 'score must be a number.' })
  @Min(0, { message: 'score must be at least 0.' })
  @Max(100, { message: 'score must be at most 100.' })
  score!: number;
}
