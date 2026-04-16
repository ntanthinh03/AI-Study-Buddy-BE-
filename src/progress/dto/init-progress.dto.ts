import { IsUUID } from 'class-validator';

export class InitProgressDto {
  @IsUUID('4', { message: 'documentId must be a valid UUID.' })
  documentId!: string;
}
