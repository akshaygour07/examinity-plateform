import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { ExamsController } from "./exams.controller";
import { ExamsRepository } from "./exams.repository";
import { ExamsService } from "./exams.service";

@Module({ imports: [AuditModule], controllers: [ExamsController], providers: [ExamsRepository, ExamsService], exports: [ExamsService] })
export class ExamsModule {}
