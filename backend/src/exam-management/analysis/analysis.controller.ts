import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { AnalysisDto } from "./dto/analysis.dto";
import { AnalysisService } from "./analysis.service";
@Controller()
export class AnalysisController {
  constructor(private readonly service: AnalysisService) {}
  @Get("public/exam-cycles/:cycleId/analysis") pub(@Param("cycleId") id: string) {
    return this.service.list(id, true);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/analysis")
  @RequirePermissions("exam.catalogue.read")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @Post("admin/exam-cycles/:cycleId/analysis") @RequirePermissions("exam.catalogue.update") create(
    @Param("cycleId") id: string,
    @Body() d: AnalysisDto,
  ) {
    return this.service.create(id, d);
  }
}
