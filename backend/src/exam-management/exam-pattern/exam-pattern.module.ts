import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { ExamPatternController } from "./exam-pattern.controller";
import { ExamPatternService } from "./exam-pattern.service";
@Module({ imports: [AuditModule], controllers: [ExamPatternController], providers: [ExamPatternService], exports: [ExamPatternService] })
export class ExamPatternModule {}
