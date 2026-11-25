import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { EligibilityService } from "./eligibility.service";
@Controller()
export class EligibilityController {
  constructor(private readonly service: EligibilityService) {}
  @Get("public/exam-cycles/:cycleId/eligibility") publicConfig(@Param("cycleId") id: string) {
    return this.service.publicConfig(id);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/eligibility")
  @RequirePermissions("exam.eligibility.read")
  adminProfile(@Param("cycleId") id: string) {
    return this.service.adminProfile(id);
  }
}
