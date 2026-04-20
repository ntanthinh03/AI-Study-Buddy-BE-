import { IsEmail, Matches } from 'class-validator';
import { AUTH_VALIDATION_MESSAGES } from '../../common/constants/messages';

export class VerifyResetOtpDto {
  @IsEmail({}, { message: AUTH_VALIDATION_MESSAGES.EMAIL_INVALID })
  email!: string;

  @Matches(/^\d{6}$/, {
    message: AUTH_VALIDATION_MESSAGES.OTP_MUST_BE_6_DIGITS,
  })
  otp!: string;
}
