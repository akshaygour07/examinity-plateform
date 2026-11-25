import { Module } from "@nestjs/common";
// Both controllers live in the same file; import them in a single statement.
import { AdminUsersController, UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SessionsService } from "../sessions/sessions.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, Auth0Guard, AuthorizationGuard, SessionsService],
})
export class UsersModule {}
