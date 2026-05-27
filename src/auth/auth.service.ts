import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { PasswordReset } from './entities/password-reset.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { ProfileUpdateOtp } from './entities/profile-update-otp.entity';
import { User } from '../users/entities/user.entity';
import { AUTH_MESSAGES } from '../common/constants/messages';
import { randomInt } from 'crypto';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailerService: MailerService,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(PasswordResetOtp)
    private passwordResetOtpRepository: Repository<PasswordResetOtp>,
    @InjectRepository(ProfileUpdateOtp)
    private profileUpdateOtpRepository: Repository<ProfileUpdateOtp>,
  ) {}

  async register(dto: RegisterDto) {
    const userExists = await this.usersService.findByEmail(dto.email);
    if (userExists) {
      throw new BadRequestException(AUTH_MESSAGES.EMAIL_IN_USE);
    }

    if (!dto.phoneNumber || !dto.phoneNumber.trim()) {
      throw new BadRequestException(AUTH_MESSAGES.PHONE_REQUIRED);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      major: dto.major,
      provider: 'local',
    });
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.EMAIL_NOT_FOUND);
    }

    const isPasswordMatching = await bcrypt.compare(password, user.password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException(AUTH_MESSAGES.PASSWORD_INCORRECT);
    }

    return this.generateTokens(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '1h',
        secret:
          this.configService.get<string>('JWT_SECRET') || 'fallback_secret_key',
      }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        major: user.major,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException(AUTH_MESSAGES.ACCOUNT_NOT_FOUND_FOR_EMAIL);
    }

    if (!user.phoneNumber) {
      await this.passwordResetRepository.save({
        user,
        requestedEmail: dto.email,
        requestedPhone: dto.phoneNumber,
        isSuccessful: false,
        reason: 'User has no phone number',
      });
      throw new BadRequestException(AUTH_MESSAGES.REGISTERED_PHONE_REQUIRED);
    }

    const normalizedPhone = this.normalizePhone(user.phoneNumber);
    const normalizedRequestedPhone = this.normalizePhone(dto.phoneNumber);

    if (normalizedPhone !== normalizedRequestedPhone) {
      await this.passwordResetRepository.save({
        user,
        requestedEmail: dto.email,
        requestedPhone: dto.phoneNumber,
        isSuccessful: false,
        reason: 'Phone mismatch',
      });
      throw new UnauthorizedException(AUTH_MESSAGES.EMAIL_OR_PHONE_INCORRECT);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    await this.passwordResetRepository.save({
      user,
      requestedEmail: dto.email,
      requestedPhone: dto.phoneNumber,
      isSuccessful: true,
      reason: 'Password reset success',
    });

    return { message: AUTH_MESSAGES.PASSWORD_RESET_COMPLETED };
  }

  async sendForgotPasswordOtp(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundException(AUTH_MESSAGES.ACCOUNT_NOT_FOUND_FOR_EMAIL);
    }

    const otp = this.generateSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresInMinutes = Number(
      this.configService.get<string>('RESET_OTP_EXPIRES_IN_MINUTES') ?? '10',
    );
    const expiresAt = new Date(Date.now() + otpExpiresInMinutes * 60 * 1000);

    const otpRecord = await this.passwordResetOtpRepository.save({
      user,
      requestedEmail: normalizedEmail,
      otpHash,
      expiresAt,
      attemptCount: 0,
      verifiedAt: null,
      usedAt: null,
      resetCompletedAt: null,
    });

    try {
      await this.mailerService.sendPasswordResetOtpEmail(
        normalizedEmail,
        otp,
        otpExpiresInMinutes,
      );
    } catch (error) {
      await this.passwordResetOtpRepository.delete({ id: otpRecord.id });
      throw error;
    }

    return {
      message: AUTH_MESSAGES.OTP_SENT_IF_ACCOUNT_EXISTS,
      expiresInMinutes: otpExpiresInMinutes,
    };
  }

  async verifyForgotPasswordOtp(email: string, otp: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const otpRecord = await this.passwordResetOtpRepository.findOne({
      where: {
        requestedEmail: normalizedEmail,
        usedAt: IsNull(),
        resetCompletedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException(AUTH_MESSAGES.OTP_INVALID_OR_EXPIRED);
    }

    const maxAttempts = Number(
      this.configService.get<string>('RESET_OTP_MAX_ATTEMPTS') ?? '5',
    );

    if (otpRecord.attemptCount >= maxAttempts) {
      throw new BadRequestException(AUTH_MESSAGES.OTP_TOO_MANY_ATTEMPTS);
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isOtpValid) {
      otpRecord.attemptCount += 1;
      if (otpRecord.attemptCount >= maxAttempts) {
        otpRecord.usedAt = new Date();
      }
      await this.passwordResetOtpRepository.save(otpRecord);

      throw new BadRequestException(
        otpRecord.attemptCount >= maxAttempts
          ? AUTH_MESSAGES.OTP_TOO_MANY_ATTEMPTS
          : AUTH_MESSAGES.OTP_INVALID_OR_EXPIRED,
      );
    }

    otpRecord.verifiedAt = new Date();
    await this.passwordResetOtpRepository.save(otpRecord);

    return { message: AUTH_MESSAGES.OTP_VERIFIED };
  }

  async resetPasswordByOtp(email: string, newPassword: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const otpRecord = await this.passwordResetOtpRepository.findOne({
      where: {
        requestedEmail: normalizedEmail,
        verifiedAt: Not(IsNull()),
        usedAt: IsNull(),
        resetCompletedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException(AUTH_MESSAGES.OTP_INVALID_OR_EXPIRED);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(otpRecord.user.id, hashedPassword);

    otpRecord.usedAt = new Date();
    otpRecord.resetCompletedAt = new Date();
    await this.passwordResetOtpRepository.save(otpRecord);

    await this.passwordResetRepository.save({
      user: otpRecord.user,
      requestedEmail: otpRecord.user.email,
      requestedPhone: otpRecord.user.phoneNumber ?? '',
      isSuccessful: true,
      reason: 'Password reset via OTP email token',
    });

    return { message: AUTH_MESSAGES.PASSWORD_RESET_COMPLETED };
  }

  async changePassword(email: string, dto: ChangePasswordDto) {
    if (!email) {
      throw new UnauthorizedException(AUTH_MESSAGES.AUTHENTICATION_REQUIRED);
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException(AUTH_MESSAGES.NO_ACCOUNT_FOUND);
    }

    if (!user.password) {
      throw new BadRequestException(AUTH_MESSAGES.LOCAL_PASSWORD_REQUIRED);
    }

    const isOldPasswordMatching = await bcrypt.compare(
      dto.oldPassword,
      user.password,
    );
    if (!isOldPasswordMatching) {
      throw new UnauthorizedException(AUTH_MESSAGES.CURRENT_PASSWORD_INCORRECT);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: AUTH_MESSAGES.PASSWORD_CHANGED };
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateSixDigitOtp() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async getUserProfile(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      major: user.major,
      avatar: user.avatar,
    };
  }

  async updateAvatar(email: string, avatar: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    user.avatar = avatar;
    await this.profileUpdateOtpRepository.manager.save(user);
    return this.getUserProfile(email);
  }

  async updateMajor(email: string, major: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Account not found.');
    }
    user.major = major;
    await this.profileUpdateOtpRepository.manager.save(user);
    return this.getUserProfile(email);
  }

  async sendProfileUpdateOtp(currentUserEmail: string, type: 'email' | 'phone', targetValue: string) {
    const user = await this.usersService.findByEmail(currentUserEmail);
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    const value = targetValue.trim();

    if (type === 'email') {
      const emailInUse = await this.usersService.findByEmail(value);
      if (emailInUse && emailInUse.id !== user.id) {
        throw new BadRequestException('This email is already in use by another account.');
      }
    }

    const otp = this.generateSixDigitOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const otpRecord = await this.profileUpdateOtpRepository.save({
      user,
      type,
      targetValue: value,
      otpHash,
      expiresAt,
      verifiedAt: null,
    });

    const sendToEmail = user.email;

    try {
      await this.mailerService.sendProfileUpdateOtpEmail(sendToEmail, otp, type);
    } catch (error) {
      await this.profileUpdateOtpRepository.delete({ id: otpRecord.id });
      throw error;
    }

    return {
      message: `Verification code sent to your current email address: ${sendToEmail}`,
      expiresInMinutes: 10,
    };
  }

  async verifyProfileUpdateOtp(currentUserEmail: string, type: 'email' | 'phone', targetValue: string, otp: string) {
    const user = await this.usersService.findByEmail(currentUserEmail);
    if (!user) {
      throw new NotFoundException('Account not found.');
    }

    const value = targetValue.trim();

    const otpRecord = await this.profileUpdateOtpRepository.findOne({
      where: {
        user: { id: user.id },
        type,
        targetValue: value,
        verifiedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP code.');
    }

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Incorrect OTP code.');
    }

    otpRecord.verifiedAt = new Date();
    await this.profileUpdateOtpRepository.save(otpRecord);

    if (type === 'email') {
      user.email = value;
    } else if (type === 'phone') {
      user.phoneNumber = value;
    }
    await this.profileUpdateOtpRepository.manager.save(user);

    return this.getUserProfile(user.email);
  }
}
