import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { PrismaService } from "./database/prisma.service";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { ResponseInterceptor } from "./common/response.interceptor";
import { MaintenanceModeMiddleware } from "./platform/maintenance-mode.middleware";

async function bootstrap() {
  // Startup failures must be visible to the local demo runner. Buffering logs
  // hides Nest dependency/configuration errors and leaves only a health timeout.
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use(
    pinoHttp({
      genReqId: (req, res) => {
        const supplied = req.headers["x-request-id"];
        const id = typeof supplied === "string" && /^[A-Za-z0-9._-]{1,100}$/.test(supplied) ? supplied : randomUUID();
        res.setHeader("X-Request-ID", id);
        return id;
      },
      redact: ["req.headers.authorization", "req.headers.cookie"],
    }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.some((origin) => process.env.NODE_ENV === "production" && !origin.startsWith("https://")))
    throw new Error("CORS_ORIGINS must contain valid HTTPS origins in production");
  app.enableCors({ origin: corsOrigins, credentials: false });
  const maintenanceMode = new MaintenanceModeMiddleware(app.get(PrismaService));
  app.use(maintenanceMode.use.bind(maintenanceMode));
  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
  const openApiConfig = new DocumentBuilder()
    .setTitle("Examinity Platform API")
    .setDescription("Authentication and application identity API")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, openApiConfig, { ignoreGlobalPrefix: false }));
  app.enableShutdownHooks();
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
