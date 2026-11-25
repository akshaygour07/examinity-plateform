import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { OverviewController } from "./overview.controller";
import { OverviewService } from "./overview.service";
@Module({ imports: [AuditModule], controllers: [OverviewController], providers: [OverviewService], exports: [OverviewService] })
export class OverviewModule {}
