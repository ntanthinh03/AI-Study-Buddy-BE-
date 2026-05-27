import {
  Body,
  Controller,
  Get,
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
import { ResetPasswordByOtpDto } from './dto/reset-password-by-otp.dto';
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

  @Post('forgot-password/reset-password')
  async resetPasswordByOtp(@Body() dto: ResetPasswordByOtpDto) {
    return this.authService.resetPasswordByOtp(dto.email, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user?.email, dto);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getUserProfile(req.user?.email);
  }

  @Post('profile/update-major')
  @UseGuards(AuthGuard('jwt'))
  async updateMajor(
    @Req() req: AuthenticatedRequest,
    @Body() body: { major: string },
  ) {
    return this.authService.updateMajor(req.user?.email, body.major);
  }

  @Post('profile/update-avatar')
  @UseGuards(AuthGuard('jwt'))
  async updateAvatar(
    @Req() req: AuthenticatedRequest,
    @Body() body: { avatar: string },
  ) {
    return this.authService.updateAvatar(req.user?.email, body.avatar);
  }

  @Post('profile/send-otp')
  @UseGuards(AuthGuard('jwt'))
  async sendProfileUpdateOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { type: 'email' | 'phone'; value: string },
  ) {
    return this.authService.sendProfileUpdateOtp(
      req.user?.email,
      body.type,
      body.value,
    );
  }

  @Post('profile/verify-otp')
  @UseGuards(AuthGuard('jwt'))
  async verifyProfileUpdateOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: { type: 'email' | 'phone'; value: string; otp: string },
  ) {
    return this.authService.verifyProfileUpdateOtp(
      req.user?.email,
      body.type,
      body.value,
      body.otp,
    );
  }
}
