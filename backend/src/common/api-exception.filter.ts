import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Global exception filter that converts every thrown exception — whether an
 * NestJS `HttpException` or an unexpected runtime error — into the standard
 * Examinity error envelope:
 *
 * ```json
 * {
 *   "error": {
 *     "code":       "<machine_readable_code>",
 *     "message":    "<human_readable_message>",
 *     "details":    {},
 *     "request_id": "<id>"
 *   }
 * }
 * ```
 *
 * Security rules enforced here:
 * - Stack traces, SQL statements, database credentials, provider secrets, JWTs,
 *   and internal infrastructure details are NEVER included in the response body.
 * - Validation errors (`class-validator` arrays) are surfaced as a `details.fields`
 *   array capped at 20 entries so clients can present field-level feedback.
 * - 500-level errors always use the generic `internal_server_error` code to avoid
 *   leaking implementation details.
 *
 * The filter is registered globally in `main.ts` before any route handler runs.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR)
      this.logger.error(
        `Unhandled request failure: ${request.method} ${request.originalUrl ?? request.url} (request_id=${request.id ?? "unknown"})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
    const validationMessages = Array.isArray(body.message)
      ? body.message.filter((item): item is string => typeof item === "string").slice(0, 20)
      : undefined;
    const safeCode =
      typeof body.code === "string"
        ? body.code
        : status === 500
          ? "internal_server_error"
          : validationMessages
            ? "validation_error"
            : "request_failed";
    const safeMessage =
      typeof body.message === "string"
        ? body.message
        : validationMessages
          ? "The request contains invalid fields."
          : status === 500
            ? "An unexpected error occurred."
            : "The request could not be completed.";
    const details =
      body.details && typeof body.details === "object" ? body.details : validationMessages ? { fields: validationMessages } : {};
    response.status(status).json({
      error: {
        code: safeCode,
        message: safeMessage,
        details,
        request_id: request.id ?? String(request.headers["x-request-id"] ?? "unknown"),
      },
    });
  }
}
