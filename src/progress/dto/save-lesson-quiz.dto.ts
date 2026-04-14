import { IsArray, IsNotEmpty } from 'class-validator';

export class SaveLessonQuizDto {
  @IsArray()
  @IsNotEmpty()
  quiz: unknown[];
}
