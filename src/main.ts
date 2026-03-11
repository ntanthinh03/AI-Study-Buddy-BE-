import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Ưu tiên lấy PORT từ .env, nếu không có mới dùng 3001
  const port = process.env.PORT || 3001; 
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();  