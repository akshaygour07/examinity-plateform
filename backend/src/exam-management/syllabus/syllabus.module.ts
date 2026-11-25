import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { SyllabusController } from "./syllabus.controller";
import { SyllabusService } from "./syllabus.service";
@Module({ imports: [AuditModule], controllers: [SyllabusController], providers: [SyllabusService], exports: [SyllabusService] })
export class SyllabusModule {}
