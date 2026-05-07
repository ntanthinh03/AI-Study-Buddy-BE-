import { IsString, IsArray, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @IsArray()
  @IsNotEmpty()
  questions: any[];

  @IsString()
  @IsOptional()
  quizName?: string;

  @IsString()
  @IsOptional()
  quizTitle?: string;
}
