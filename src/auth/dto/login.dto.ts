import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'The email address is invalid.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, { message: 'The password must be at least 6 characters long.' })
  password!: string;
}
