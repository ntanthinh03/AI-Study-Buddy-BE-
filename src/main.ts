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

  app.use((req, res, next) => {
    const startedAt = Date.now();
    const hasAuthHeader = typeof req.headers.authorization === 'string' && req.headers.authorization.length > 0;

    console.log(
      `[HTTP-IN] ${req.method} ${req.originalUrl} | auth=${hasAuthHeader ? 'yes' : 'no'}`,
    );

    res.on('finish', () => {
      const duration = Date.now() - startedAt;
      console.log(
        `[HTTP-OUT] ${req.method} ${req.originalUrl} | status=${res.statusCode} | ${duration}ms`,
      );
    });

    next();
  });

  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  const preferredPort = Number(process.env.PORT ?? 3001);
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const ollamaTextModel = process.env.OLLAMA_TEXT_MODEL ?? 'qwen2.5:14b-instruct';
  const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL ?? 'llama3.2-vision:11b';

  let activePort = preferredPort;
  let started = false;
  const maxAttempts = 20;

  for (let i = 0; i < maxAttempts; i++) {
    const candidatePort = preferredPort + i;
    try {
      await app.listen(candidatePort);
      activePort = candidatePort;
      started = true;
      if (candidatePort !== preferredPort) {
        console.warn(
          `Port ${preferredPort} is already in use. Running on fallback port ${candidatePort}.`,
        );
      }
      break;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EADDRINUSE') {
        throw error;
      }
    }
  }

  if (!started) {
    throw new Error(
      `Could not start server. Ports ${preferredPort}-${preferredPort + maxAttempts - 1} are unavailable.`,
    );
  }

  console.log(`\n--- AI STUDY BUDDY BACKEND ---`);
  console.log(`Server status : Running on http://localhost:${activePort}`);
  console.log(`Local AI      : Ollama connected at ${ollamaBaseUrl}`);
  console.log(`Text model    : ${ollamaTextModel}`);
  console.log(`Vision model  : ${ollamaVisionModel}`);
  console.log(`-------------------------------\n`);
}
bootstrap();