import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { SessionsService } from "../sessions/sessions.service";

@Module({
  imports: [AuditModule],
  controllers: [MediaController],
  providers: [MediaService, Auth0Guard, AuthorizationGuard, SessionsService],
})
export class MediaModule {}
