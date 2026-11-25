import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./database/prisma.service";

@ApiTags("health")
@Controller("health")
/** Unauthenticated process liveness and dependency readiness probes for load balancers and monitoring. */
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  @ApiOperation({ summary: "Process liveness" })
  /** Confirms the HTTP process can respond; it intentionally does not check dependencies. */
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "API and database readiness" })
  /** Returns 503 until required Auth0 settings are valid and PostgreSQL accepts a query. */
  async ready() {
    const issuer = process.env.AUTH0_ISSUER_BASE_URL;
    const audience = process.env.API_AUDIENCE;
    const clockTolerance = Number(process.env.JWT_CLOCK_TOLERANCE_SECONDS ?? 60);
    if (!issuer || !audience)
      throw new ServiceUnavailableException({
        code: "required_configuration_missing",
        message: "The API is not configured to serve authenticated traffic.",
      });
    if (!Number.isInteger(clockTolerance) || clockTolerance < 0 || clockTolerance > 300)
      throw new ServiceUnavailableException({
        code: "required_configuration_invalid",
        message: "The API is not configured to serve authenticated traffic.",
      });
    try {
      const url = new URL(issuer);
      if (!url.hostname || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("invalid issuer");
    } catch {
      throw new ServiceUnavailableException({
        code: "required_configuration_invalid",
        message: "The API is not configured to serve authenticated traffic.",
      });
    }
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready" };
  }
}
