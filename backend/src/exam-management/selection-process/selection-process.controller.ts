import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { CreateSelectionProcessDto, SelectionStageDto } from "./dto/selection-process.dto";
import { SelectionProcessService } from "./selection-process.service";
@Controller()
export class SelectionProcessController {
  constructor(private readonly service: SelectionProcessService) {}
  @Get("public/exam-cycles/:cycleId/selection-process") pub(@Param("cycleId") id: string) {
    return this.service.list(id, true);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/selection-process")
  @RequirePermissions("exam.pattern.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @Post("admin/exam-cycles/:cycleId/selection-process") @RequirePermissions("exam.pattern.manage") create(
    @Param("cycleId") id: string,
    @Body() d: CreateSelectionProcessDto,
  ) {
    return this.service.create(id, d);
  }
  @Post("admin/selection-process/:versionId/stages") @RequirePermissions("exam.pattern.manage") stage(
    @Param("versionId") id: string,
    @Body() d: SelectionStageDto,
  ) {
    return this.service.addStage(id, d);
  }
  @Patch("admin/selection-stages/:stageId") @RequirePermissions("exam.pattern.manage") update(
    @Param("stageId") id: string,
    @Body() d: SelectionStageDto,
  ) {
    return this.service.updateStage(id, d);
  }
}
