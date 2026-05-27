import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { PasswordReset } from './entities/password-reset.entity';
import { PasswordResetOtp } from './entities/password-reset-otp.entity';
import { ProfileUpdateOtp } from './entities/profile-update-otp.entity';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    UsersModule,
    MailerModule,
    TypeOrmModule.forFeature([PasswordReset, PasswordResetOtp, ProfileUpdateOtp]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtExpiresIn = (configService.get<string>('JWT_EXPIRES_IN') ??
          '1h') as StringValue;

        return {
          secret:
            configService.get<string>('JWT_SECRET') || 'fallback_secret_key',
          signOptions: {
            expiresIn: jwtExpiresIn,
          },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
