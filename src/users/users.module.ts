import { Module } from '@nestjs/common'; // Để dùng @Module
import { TypeOrmModule } from '@nestjs/typeorm'; // Để dùng TypeOrmModule
import { User } from './entities/user.entity'; // Để dùng thực thể User
import { UsersService } from './users.service'; // Để dùng UsersService

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService], // Rất quan trọng để AuthModule có thể dùng
})
export class UsersModule {}