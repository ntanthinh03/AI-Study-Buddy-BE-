import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const { method, originalUrl, body, query, params } = request;
    const startedAt = Date.now();

    this.logger.log(
      `REQUEST ${method} ${originalUrl} | body=${JSON.stringify(this.sanitize(body))} | query=${JSON.stringify(query)} | params=${JSON.stringify(params)}`,
    );

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startedAt;
          this.logger.log(
            `RESPONSE ${method} ${originalUrl} | status=${response.statusCode} | ${duration}ms | data=${JSON.stringify(this.sanitize(data))}`,
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startedAt;
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `ERROR ${method} ${originalUrl} | status=${response.statusCode} | ${duration}ms | message=${message}`,
          );
        },
      }),
    );
  }

  private sanitize(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;

    const clone = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    const secretKeys = ['password', 'access_token', 'token'];

    for (const key of secretKeys) {
      if (key in clone) clone[key] = '***';
    }

    return clone;
  }
}
