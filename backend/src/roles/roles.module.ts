import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";
import { SessionsService } from "../sessions/sessions.service";

@Module({
  imports: [AuditModule],
  controllers: [RolesController],
  providers: [RolesService, Auth0Guard, AuthorizationGuard, SessionsService],
})
export class RolesModule {}
