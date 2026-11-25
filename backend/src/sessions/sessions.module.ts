import { Module } from "@nestjs/common";
import { MySessionsController, SessionsController } from "./sessions.controller";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../database/prisma.module";
import { Auth0Guard } from "../auth/auth0.guard";
import { SessionsService } from "./sessions.service";

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [SessionsController, MySessionsController],
  providers: [Auth0Guard, SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
