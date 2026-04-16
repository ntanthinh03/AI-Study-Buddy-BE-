import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AUTH_VALIDATION_MESSAGES } from '../../common/constants/messages';

export class ForgotPasswordDto {
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  email: string;

  @IsString()
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.PHONE_REQUIRED })
  phoneNumber: string;

  @IsString()
  @MinLength(6, {
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH,
  })
  newPassword: string;
}
