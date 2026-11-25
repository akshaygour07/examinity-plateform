import type { Request } from "express";
import type { AuthenticatedRequest } from "../auth/auth0.guard";

/** Extracts bounded request metadata used to correlate audit records without copying credentials. */
export function auditRequest(request: AuthenticatedRequest) {
  const req = request as Request & { id?: string };
  const correlation = req.headers["x-correlation-id"];
  const correlationId = typeof correlation === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(correlation) ? correlation : null;
  return {
    requestId: req.id ?? "unknown",
    correlationId,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    ipAddress: req.ip ?? null,
  };
}
