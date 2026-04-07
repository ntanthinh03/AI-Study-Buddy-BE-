import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  const port = process.env.PORT || 3001;
  const apiKey = process.env.GEMINI_API_KEY;

  await app.listen(port);

  console.log(`\n--- AI STUDY BUDDY BACKEND ---`);
  console.log(`Server status : Running on http://localhost:${port}`);
  
  if (apiKey) {
    console.log(`Gemini Key    : Loaded successfully (Length: ${apiKey.length})`);
  } else {
    console.log(`Gemini Key    : ERROR - Not found in .env file`);
  }
  console.log(`-------------------------------\n`);
}
bootstrap();