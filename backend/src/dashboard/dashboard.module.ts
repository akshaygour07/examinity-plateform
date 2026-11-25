import { Module } from "@nestjs/common";
import { Auth0Guard } from "../auth/auth0.guard";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { AuditModule } from "../audit/audit.module";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { SessionsService } from "../sessions/sessions.service";

/** Registers the authenticated Module 1 landing-page endpoint. */
@Module({
  imports: [AuditModule],
  controllers: [DashboardController],
  providers: [DashboardService, Auth0Guard, AuthorizationGuard, SessionsService],
})
export class DashboardModule {}
