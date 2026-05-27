import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AUTH_VALIDATION_MESSAGES } from '../../common/constants/messages';

export class RegisterDto {
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, {
    message: AUTH_VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH,
  })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.FULL_NAME_REQUIRED })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: AUTH_VALIDATION_MESSAGES.PHONE_REQUIRED })
  phoneNumber!: string;

  @IsString()
  @IsOptional()
  major?: string;
}
