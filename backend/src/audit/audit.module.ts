import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { Auth0Guard } from "../auth/auth0.guard";
import { SessionsService } from "../sessions/sessions.service";

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuthorizationGuard, Auth0Guard, SessionsService],
  exports: [AuditService, AuthorizationGuard],
})
export class AuditModule {}
