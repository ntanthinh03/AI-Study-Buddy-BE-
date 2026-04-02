import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const port = process.env.PORT || 3001;
  const apiKey = process.env.GEMINI_API_KEY;

  await app.listen(port);

  console.log(`--- AI STUDY BUDDY BACKEND ---`);
  console.log(`Server status: running on http://localhost:${port}`);
  
  if (apiKey) {
    console.log(`Gemini API Key: Loaded successfully (Length: ${apiKey.length})`);
  } else {
    console.log(`Gemini API Key: ERROR - Not found in .env file`);
  }
}
bootstrap();