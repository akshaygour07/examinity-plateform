import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisRepository } from "./analysis.repository";
import { AnalysisService } from "./analysis.service";
@Module({
  imports: [AuditModule],
  controllers: [AnalysisController],
  providers: [AnalysisRepository, AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
