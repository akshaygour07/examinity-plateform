import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { SelectionProcessController } from "./selection-process.controller";
import { SelectionProcessRepository } from "./selection-process.repository";
import { SelectionProcessService } from "./selection-process.service";
@Module({
  imports: [AuditModule],
  controllers: [SelectionProcessController],
  providers: [SelectionProcessRepository, SelectionProcessService],
  exports: [SelectionProcessService],
})
export class SelectionProcessModule {}
