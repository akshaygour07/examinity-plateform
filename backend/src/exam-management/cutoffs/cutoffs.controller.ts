import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { CutoffDto } from "./dto/cutoff.dto";
import { CutoffsService } from "./cutoffs.service";
@Controller()
export class CutoffsController {
  constructor(private readonly service: CutoffsService) {}
  @Get("public/exam-cycles/:cycleId/cutoffs") pub(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/cutoffs")
  @RequirePermissions("exam.cutoff.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  @Post("admin/exam-cycles/:cycleId/cutoffs") @RequirePermissions("exam.cutoff.manage") create(
    @Param("cycleId") id: string,
    @Body() d: CutoffDto,
  ) {
    return this.service.create(id, d);
  }
}
