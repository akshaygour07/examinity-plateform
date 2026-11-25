import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { ExamPatternService } from "./exam-pattern.service";
@Controller()
export class ExamPatternController {
  constructor(private readonly service: ExamPatternService) {}
  @Get("public/exam-cycles/:cycleId/pattern") publicPattern(@Param("cycleId") id: string) {
    return this.service.cyclePattern(id, true);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/pattern")
  @RequirePermissions("exam.pattern.manage")
  adminPattern(@Param("cycleId") id: string) {
    return this.service.cyclePattern(id);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/pattern-versions/:versionId")
  @RequirePermissions("exam.pattern.manage")
  version(@Param("versionId") id: string) {
    return this.service.version(id);
  }
}
