import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { ProgressModule } from './progress/progress.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Giúp các module khác không cần import lại ConfigModule
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        port: parseInt(configService.get<string>('DB_PORT') ?? '5432'),
        username: configService.get<string>('DB_USERNAME') ?? 'postgres',
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE') ?? 'study_buddy_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        autoLoadEntities: true,
        // ✅ Chuyển thành true để tạo bảng Quizzes và UserProgress mới
        synchronize: false, // Để tránh mất dữ liệu, hãy để synchronize: false sau khi đã tạo bảng thành công
      }),
      inject: [ConfigService], 
    }),

    DocumentsModule,
    QuizzesModule,
    ProgressModule, // ✅ Đăng ký ở đây

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}