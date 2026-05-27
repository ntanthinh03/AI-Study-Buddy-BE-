import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { ProgressModule } from './progress/progress.module';
import { ChatModule } from './chat/chat.module';
import { RagModule } from './modules/rag/rag.module';
import { AiModule } from './modules/ai/ai.module';
import { FlashcardsModule } from './modules/flashcards/flashcards.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { StudySessionsModule } from './modules/study-sessions/study-sessions.module';
import { StudyRoomsModule } from './modules/study-rooms/study-rooms.module';
import { MindMapsModule } from './modules/mind-maps/mind-maps.module';
import { ScheduleModule } from '@nestjs/schedule';
import { VersusArenaModule } from './modules/versus-arena/versus-arena.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        port: parseInt(configService.get<string>('DB_PORT') ?? '5432'),
        username: configService.get<string>('DB_USERNAME') ?? 'postgres',
        password: configService.get<string>('DB_PASSWORD') ?? '1',
        database: configService.get<string>('DB_DATABASE') ?? 'postgres',
        entities: [__dirname + '*.entity{.ts,.js}'],
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),

    UsersModule,
    AuthModule,
    DocumentsModule,
    QuizzesModule,
    ProgressModule,
    ChatModule,
    RagModule,
    AiModule,
    FlashcardsModule,
    AnalyticsModule,
    StudySessionsModule,
    StudyRoomsModule,
    MindMapsModule,
    ScheduleModule.forRoot(),
    VersusArenaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
