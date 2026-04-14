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
import { Repository } from 'typeorm';
import { PasswordReset } from './entities/password-reset.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
  ) {}

  async register(dto: RegisterDto) {
    const userExists = await this.usersService.findByEmail(dto.email);
    if (userExists) {
      throw new BadRequestException('This email address is already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      provider: 'local',
    });
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('The email address does not exist.');
    }

    const isPasswordMatching = await bcrypt.compare(password, user.password);

    if (!isPasswordMatching) {
      throw new UnauthorizedException('The password is incorrect.');
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
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('No account was found for this email address.');
    }

    if (!user.phoneNumber) {
      await this.passwordResetRepository.save({
        user,
        requestedEmail: dto.email,
        requestedPhone: dto.phoneNumber,
        isSuccessful: false,
        reason: 'User has no phone number',
      });
      throw new BadRequestException('The account does not have a phone number for verification.');
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
      throw new UnauthorizedException('The email address or phone number is incorrect.');
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

    return { message: 'Password reset completed successfully.' };
  }

  async changePassword(email: string, dto: ChangePasswordDto) {
    if (!email) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('No account was found.');
    }

    if (!user.password) {
      throw new BadRequestException('The account does not use a local password.');
    }

    const isOldPasswordMatching = await bcrypt.compare(
      dto.oldPassword,
      user.password,
    );
    if (!isOldPasswordMatching) {
      throw new UnauthorizedException('The current password is incorrect.');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    return { message: 'Password changed successfully.' };
  }

  private normalizePhone(phone: string) {
    return phone.replace(/\D/g, '');
  }
}
