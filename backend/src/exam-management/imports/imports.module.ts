import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { SessionsService } from "../../sessions/sessions.service";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  imports: [AuditModule],
  controllers: [ImportsController],
  providers: [ImportsService, Auth0Guard, AuthorizationGuard, SessionsService],
})
export class ImportsModule {}
