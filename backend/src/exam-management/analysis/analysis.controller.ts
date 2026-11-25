import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { AnalysisDto } from "./dto/analysis.dto";
import { AnalysisService } from "./analysis.service";
@Controller()
export class AnalysisController {
  constructor(private readonly service: AnalysisService) {}
  /**
   * List published exam analysis. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List published exam analysis",
    description: "List published exam analysis. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/analysis")
  pub(@Param("cycleId") id: string) {
    return this.service.list(id, true);
  }
  /**
   * List exam analysis records. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List exam analysis records",
    description:
      "List exam analysis records. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/analysis")
  @RequirePermissions("exam.catalogue.read")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * Create an exam analysis record. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam analysis record",
    description:
      "Create an exam analysis record. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/analysis")
  @RequirePermissions("exam.catalogue.update")
  create(@Param("cycleId") id: string, @Body() d: AnalysisDto) {
    return this.service.create(id, d);
  }
}
