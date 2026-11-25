import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { SalaryDto } from "./dto/salary.dto";
import { SalaryService } from "./salary.service";
@Controller()
export class SalaryController {
  constructor(private readonly service: SalaryService) {}
  /**
   * List public salary records. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public salary records",
    description: "List public salary records. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/salary")
  pub(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * List salary records for a cycle. Requires the exam.salary.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List salary records for a cycle",
    description:
      "List salary records for a cycle. Requires the exam.salary.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/salary")
  @RequirePermissions("exam.salary.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * Create a salary record. Requires the exam.salary.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create a salary record",
    description:
      "Create a salary record. Requires the exam.salary.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/salary")
  @RequirePermissions("exam.salary.manage")
  create(@Param("cycleId") id: string, @Body() d: SalaryDto) {
    return this.service.create(id, d);
  }
}
