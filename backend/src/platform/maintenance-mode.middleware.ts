import type { NextFunction, Request, Response } from "express";
import type { PrismaService } from "../database/prisma.service";

type RequestWithId = Request & { id?: string };

/** Enforces the persisted maintenance switch while allowing health checks and the authorized switch-off route. */
export class MaintenanceModeMiddleware {
  private checkedAt = 0;
  private enabled = false;
  private pending?: Promise<boolean>;
  private readonly cacheMs = 2_000;

  constructor(private readonly prisma: Pick<PrismaService, "configuration">) {}

  /** Reads the maintenance setting with a short cache and coalesces concurrent refreshes. */
  private async isEnabled() {
    if (Date.now() - this.checkedAt < this.cacheMs) return this.enabled;
    this.pending ??= this.prisma.configuration
      .findUnique({ where: { configKey: "maintenance_mode" }, select: { valueJson: true, status: true } })
      .then((setting) => {
        this.enabled = setting?.status === "ACTIVE" && setting.valueJson === true;
        this.checkedAt = Date.now();
        return this.enabled;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }

  /** Allows health/docs and switch-off traffic, then blocks other requests while maintenance is enabled. */
  use(request: RequestWithId, response: Response, next: NextFunction) {
    const path = request.path;
    const healthCheck = request.method === "GET" && (path === "/health/live" || path === "/health/ready");
    const swaggerDocs = request.method === "GET" && (path === "/api/docs" || path.startsWith("/api/docs/") || path === "/api/docs-json");
    const disableMaintenance = request.method === "PUT" && path === "/api/v1/configurations/maintenance_mode";
    if (healthCheck || swaggerDocs || disableMaintenance) return next();

    void this.isEnabled()
      .then((enabled) => {
        if (!enabled) return next();
        return response.status(503).json({
          error: {
            code: "maintenance_mode",
            message: "The application is temporarily unavailable for maintenance.",
            details: {},
            request_id: request.id ?? String(request.headers["x-request-id"] ?? "unknown"),
          },
        });
      })
      .catch(() =>
        response.status(503).json({
          error: {
            code: "service_configuration_unavailable",
            message: "The application configuration is temporarily unavailable.",
            details: {},
            request_id: request.id ?? String(request.headers["x-request-id"] ?? "unknown"),
          },
        }),
      );
  }
}
