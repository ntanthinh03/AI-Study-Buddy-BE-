import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SendResetOtpDto } from './dto/send-reset-otp.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordWithTokenDto } from './dto/reset-password-with-token.dto';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe())
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('forgot-password/send-otp')
  async sendForgotPasswordOtp(@Body() dto: SendResetOtpDto) {
    return this.authService.sendForgotPasswordOtp(dto.email);
  }

  @Post('forgot-password/verify-otp')
  async verifyForgotPasswordOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyForgotPasswordOtp(dto.email, dto.otp);
  }

  @Post('forgot-password/reset-with-token')
  async resetPasswordWithToken(@Body() dto: ResetPasswordWithTokenDto) {
    return this.authService.resetPasswordWithToken(dto.resetToken, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user?.email, dto);
  }
}
