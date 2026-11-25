import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { map, Observable } from "rxjs";

/**
 * Wraps every successful HTTP response in the standard Examinity envelope:
 *
 * ```json
 * { "data": <payload>, "meta": { ...pagination?, "request_id": "<id>" } }
 * ```
 *
 * The `request_id` is sourced from the `id` property attached by the Pino HTTP
 * logger middleware, falling back to the `X-Request-Id` header when present.
 *
 * Pagination metadata — when the service returns a top-level `pagination` key —
 * is merged into `meta` so callers receive a flat, consistent structure.
 *
 * Error responses are NOT wrapped here; `ApiExceptionFilter` handles those.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { id?: string }>();
    return next.handle().pipe(
      map((body: unknown) => {
        const requestId = request.id ?? String(request.headers["x-request-id"] ?? "unknown");
        if (body && typeof body === "object" && "data" in body) {
          const result = body as { data: unknown; meta?: Record<string, unknown>; pagination?: Record<string, unknown> };
          return { data: result.data, meta: { ...(result.meta ?? {}), ...(result.pagination ?? {}), request_id: requestId } };
        }
        return { data: body, meta: { request_id: requestId } };
      }),
    );
  }
}
