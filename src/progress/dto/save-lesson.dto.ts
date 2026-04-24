import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class SaveLessonDto {
  @IsUUID('4', { message: 'conversationId must be a valid UUID.' })
  conversationId!: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  contentText: string;

  @IsOptional()
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status?: 'IN_PROGRESS' | 'COMPLETED';
}
