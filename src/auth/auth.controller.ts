import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth') // Đây là gốc /auth
export class AuthController {
  constructor(private authService: AuthService) {}

  // API Đăng ký (Bạn đã làm rồi)
  @Post('register')
  @UsePipes(new ValidationPipe())
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // ✅ THÊM API ĐĂNG NHẬP Ở ĐÂY
  @Post('login')
  async login(@Body() loginDto: any) {
    // Gọi hàm login trong AuthService mà chúng ta đã viết trước đó
    return this.authService.login(loginDto);
  }
}