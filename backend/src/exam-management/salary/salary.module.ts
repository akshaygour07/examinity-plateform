import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { SalaryController } from "./salary.controller";
import { SalaryRepository } from "./salary.repository";
import { SalaryService } from "./salary.service";
@Module({ imports: [AuditModule], controllers: [SalaryController], providers: [SalaryRepository, SalaryService], exports: [SalaryService] })
export class SalaryModule {}
