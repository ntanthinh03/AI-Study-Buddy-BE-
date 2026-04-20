import { IsEmail, IsNotEmpty } from 'class-validator';
import { AUTH_VALIDATION_MESSAGES } from '../../common/constants/messages';

export class SendResetOtpDto {
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED })
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  email!: string;
}
