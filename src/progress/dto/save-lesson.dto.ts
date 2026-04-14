import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveLessonDto {
  @IsOptional()
  @IsString()
  documentId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  contentText: string;
}
