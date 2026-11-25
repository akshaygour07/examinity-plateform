import { Module } from "@nestjs/common";
import { AuditModule } from "../../audit/audit.module";
import { CutoffsController } from "./cutoffs.controller";
import { CutoffsRepository } from "./cutoffs.repository";
import { CutoffsService } from "./cutoffs.service";
@Module({ imports: [AuditModule], controllers: [CutoffsController], providers: [CutoffsRepository, CutoffsService], exports: [CutoffsService] })
export class CutoffsModule {}
