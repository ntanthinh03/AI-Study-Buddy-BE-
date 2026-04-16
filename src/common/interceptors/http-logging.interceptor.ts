import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

type LoggedRequest = Request<
  Record<string, never>,
  unknown,
  unknown,
  Record<string, unknown>
>;

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<LoggedRequest>();
    const response = http.getResponse<Response>();

    const { method, originalUrl, body, query, params } = request;
    const startedAt = Date.now();

    this.logger.log(
      `REQUEST ${method} ${originalUrl} | payload=${JSON.stringify(this.summarize({ body, query, params }))}`,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startedAt;
          this.logger.log(
            `RESPONSE ${method} ${originalUrl} | status=${response.statusCode} | duration=${duration}ms | data=${JSON.stringify(this.summarize(data))}`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startedAt;
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          const status =
            error instanceof HttpException
              ? error.getStatus()
              : response.statusCode;
          this.logger.error(
            `ERROR ${method} ${originalUrl} | status=${status} | duration=${duration}ms | message=${message}`,
          );
        },
      }),
    );
  }

  private summarize(value: unknown, depth = 1): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.truncate(value, 160);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return {
        kind: 'array',
        length: value.length,
        sample: depth > 0 ? value.slice(0, 3).map((item) => this.summarize(item, depth - 1)) : [],
      };
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      const summary: Record<string, unknown> = {};

      for (const [key, entryValue] of entries.slice(0, 8)) {
        summary[key] = depth > 0 ? this.summarize(entryValue, depth - 1) : this.describe(entryValue);
      }

      return summary;
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }

  private describe(value: unknown): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `array(${value.length})`;
    }

    if (typeof value === 'object') {
      return 'object';
    }

    return typeof value;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
