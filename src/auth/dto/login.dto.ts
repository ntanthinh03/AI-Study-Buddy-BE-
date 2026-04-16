import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AUTH_VALIDATION_MESSAGES } from '../../common/constants/messages';

export class LoginDto {
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, {
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH,
  })
  password!: string;
}
