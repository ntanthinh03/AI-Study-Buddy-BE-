import * as dotenv from 'dotenv';
dotenv.config();

// Polyfills for pdfjs-dist / pdf-parse in Node environments without DOM (e.g., Node < v20.16.0)
if (typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  };
}
if (typeof (global as any).ImageData === 'undefined') {
  (global as any).ImageData = class ImageData {};
}
if (typeof (global as any).Path2D === 'undefined') {
  (global as any).Path2D = class Path2D {};
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import {
  DEFAULT_OLLAMA_BASE_URL,
  normalizeOllamaBaseUrl,
} from './common/config/ollama.config';
import { BOOT_MESSAGES } from './common/constants/messages';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bootstrapLogger = new Logger('Bootstrap');

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new HttpLoggingInterceptor());

  const preferredPort = Number(process.env.PORT ?? 3001);
  const ollamaBaseUrl = normalizeOllamaBaseUrl(
    process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL,
  );
  const ollamaTextModel =
    process.env.OLLAMA_TEXT_MODEL ?? 'qwen2.5:14b-instruct';
  const ollamaVisionModel =
    process.env.OLLAMA_VISION_MODEL ?? 'llama3.2-vision:11b';
  const preferredQuantization = 'Q4_K_M';

  bootstrapLogger.log(BOOT_MESSAGES.PORT_PREFERENCE(preferredPort));

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
        bootstrapLogger.warn(
          BOOT_MESSAGES.FALLBACK_PORT_IN_USE(preferredPort, candidatePort),
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
      BOOT_MESSAGES.PORTS_UNAVAILABLE(
        preferredPort,
        preferredPort + maxAttempts - 1,
      ),
    );
  }

  bootstrapLogger.log(BOOT_MESSAGES.ACTIVE_PORT(activePort));
  bootstrapLogger.log(BOOT_MESSAGES.READY(activePort));
  bootstrapLogger.log(BOOT_MESSAGES.OLLAMA(ollamaBaseUrl));
  bootstrapLogger.log(BOOT_MESSAGES.QUANTIZATION(preferredQuantization));
  bootstrapLogger.log(BOOT_MESSAGES.TEXT_MODEL(ollamaTextModel));
  bootstrapLogger.log(BOOT_MESSAGES.VISION_MODEL(ollamaVisionModel));
}
void bootstrap();
