import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ rồi Thinh ơi!' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự nhé' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Đừng quên nhập họ tên' })
  fullName: string;
}