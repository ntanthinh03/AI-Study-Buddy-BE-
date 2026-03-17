import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your_secret_key',
    });
  }

  // ✅ Phải có hàm này để NestJS gắn thông tin vào req.user
  async validate(payload: any) {
    // Trả về object này, bạn sẽ dùng được req.user.userId ở Controller
    return { userId: payload.sub, email: payload.email };
  }
}