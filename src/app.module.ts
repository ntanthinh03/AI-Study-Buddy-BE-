import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// --- Import các Feature Modules ---
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    // 1. Cấu hình biến môi trường (.env)
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: '.env', // Đảm bảo đúng tên file bạn đã tạo
    }),

    // 2. Cấu hình Database (PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        port: parseInt(configService.get<string>('DB_PORT') ?? '5432'),
        username: configService.get<string>('DB_USERNAME') ?? 'postgres',
        password: configService.get<string>('DB_PASSWORD') ?? '1',
        
        // SỬA DÒNG NÀY: Đảm bảo lấy đúng key DB_DATABASE từ .env
        database: configService.get<string>('DB_DATABASE') ?? 'postgres', 
        
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: false, 
      }),
    }),

    // 3. Đăng ký toàn bộ Module tính năng
    UsersModule,    // Quản lý thông tin user
    AuthModule,     // Xử lý Login/Register
    DocumentsModule, // Xử lý PDF & Gemini
    QuizzesModule,   // Tạo bài tập AI
    ProgressModule,  // Theo dõi lộ trình học tập
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}