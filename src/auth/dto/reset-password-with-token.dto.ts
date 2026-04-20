import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AUTH_VALIDATION_MESSAGES } from '../../common/constants/messages';

export class ResetPasswordWithTokenDto {
  @IsString()
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.RESET_TOKEN_REQUIRED })
  resetToken!: string;

  @IsString()
  @MinLength(6, {
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH,
  })
  newPassword!: string;
}
