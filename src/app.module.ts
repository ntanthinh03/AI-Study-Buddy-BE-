import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Import Config
import { TypeOrmModule } from '@nestjs/typeorm'; // Import TypeORM
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    // 1. Cấu hình đọc file .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Cấu hình kết nối Database (Phần bạn đang thiếu)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        // Dùng ?? '5432' để đảm bảo không bị lỗi undefined
        port: parseInt(configService.get<string>('DB_PORT') ?? '5432'),
        username: configService.get<string>('DB_USERNAME') ?? 'postgres',
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE') ?? 'study_buddy_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: false, // False vì bạn đã tạo bảng thủ công bằng SQL
      }),
      inject: [ConfigService],
    }),

    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}