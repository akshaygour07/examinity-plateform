import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { SessionsService } from "../sessions/sessions.service";

@Module({
  imports: [AuditModule],
  controllers: [PlatformController],
  providers: [PlatformService, Auth0Guard, AuthorizationGuard, SessionsService],
})
export class PlatformModule {}
