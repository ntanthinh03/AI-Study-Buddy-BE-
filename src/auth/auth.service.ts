import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // ✅ Thêm để đọc .env
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto'; // Thư viện có sẵn của Node.js

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService, // ✅ Inject ConfigService
  ) {}

  // 1. ĐĂNG KÝ: Dùng DTO để validate dữ liệu từ đầu
  async register(dto: RegisterDto) {
    const userExists = await this.usersService.findByEmail(dto.email);
    if (userExists) {
        throw new BadRequestException('Email này đã được sử dụng rồi!');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      provider: 'local',
    });
  }

  // 2. ĐĂNG NHẬP: So khớp vân tay mật khẩu
  async login(loginDto: any) {
  const { email, password } = loginDto;
  const user = await this.usersService.findByEmail(email);

  if (!user) {
    throw new UnauthorizedException('Email không tồn tại!');
  }

  // Bây giờ user.password đã có giá trị chứ không còn undefined nữa
  const isPasswordMatching = await bcrypt.compare(password, user.password);
  
  if (!isPasswordMatching) {
    throw new UnauthorizedException('Mật khẩu sai rồi Thinh ơi!');
  }

  return this.generateTokens(user);
}

  // 3. TẠO TOKEN: Đọc Secret từ file .env
  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    
    return {
      access_token: await this.jwtService.signAsync(payload, {
        expiresIn: '1h',
        // ✅ Lấy từ .env giúp bảo mật tuyệt đối
        secret: this.configService.get<string>('JWT_SECRET'), 
      }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      }
    };
  }

  // 4. QUÊN MẬT KHẨU: Lưu vào bảng password_resets đã tạo ở SQL
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('Không tìm thấy User với email này');

    // Tạo mã token ngẫu nhiên và an toàn hơn Math.random
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // Hết hạn sau 1 tiếng

    // ✅ Ở ĐÂY: Thinh gọi Repository để lưu vào bảng password_resets
    // await this.passwordResetRepository.save({ userId: user.id, token: resetToken, expiresAt });
    
    console.log(`📡 Gửi Email tới ${email} kèm link: http://localhost:3000/reset-password?token=${resetToken}`);
    
    return { message: 'Link reset mật khẩu đã được gửi vào Email của bạn!' };
  }
}