import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { UsersModule } from "./users/users.module";
import { AuditModule } from "./audit/audit.module";
import { RolesModule } from "./roles/roles.module";
import { PlatformModule } from "./platform/platform.module";
import { MediaModule } from "./media/media.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { SessionsModule } from "./sessions/sessions.module";
import { ExamManagementModule } from "./exam-management/exam-management.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    AuditModule,
    RolesModule,
    PlatformModule,
    MediaModule,
    NotificationsModule,
    DashboardModule,
    SessionsModule,
    ExamManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
