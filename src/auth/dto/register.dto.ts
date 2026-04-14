import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'The email address is invalid.' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6, { message: 'The password must be at least 6 characters long.' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'The full name is required.' })
  fullName!: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
