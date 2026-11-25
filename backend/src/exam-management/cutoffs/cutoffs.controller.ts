import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { CutoffDto } from "./dto/cutoff.dto";
import { CutoffsService } from "./cutoffs.service";
@Controller()
export class CutoffsController {
  constructor(private readonly service: CutoffsService) {}
  /**
   * List public exam cutoffs. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam cutoffs",
    description: "List public exam cutoffs. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/cutoffs")
  pub(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * List exam cutoff records. Requires the exam.cutoff.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List exam cutoff records",
    description:
      "List exam cutoff records. Requires the exam.cutoff.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/cutoffs")
  @RequirePermissions("exam.cutoff.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * Create an exam cutoff record. Requires the exam.cutoff.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam cutoff record",
    description:
      "Create an exam cutoff record. Requires the exam.cutoff.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/cutoffs")
  @RequirePermissions("exam.cutoff.manage")
  create(@Param("cycleId") id: string, @Body() d: CutoffDto) {
    return this.service.create(id, d);
  }
}
