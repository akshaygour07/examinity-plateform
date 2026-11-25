import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { PutOverviewDraftDto } from "./dto/put-overview-draft.dto";
import { OverviewService } from "./overview.service";
@Controller()
export class OverviewController {
  constructor(private readonly service: OverviewService) {}
  /**
   * Get the published exam overview for a cycle. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get the published exam overview for a cycle",
    description:
      "Get the published exam overview for a cycle. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/overview")
  publicOverview(@Param("cycleId") id: string) {
    return this.service.publicOverview(id);
  }
  /**
   * List exam overview versions for a cycle. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List exam overview versions for a cycle",
    description:
      "List exam overview versions for a cycle. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/overview")
  @RequirePermissions("exam.catalogue.read")
  adminOverview(@Param("cycleId") id: string) {
    return this.service.adminOverview(id);
  }
  /**
   * Create or update the exam overview draft. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create or update the exam overview draft",
    description:
      "Create or update the exam overview draft. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Put("admin/exam-cycles/:cycleId/overview/draft")
  @RequirePermissions("exam.catalogue.update")
  saveDraft(@Param("cycleId") id: string, @Body() dto: PutOverviewDraftDto) {
    return this.service.saveDraft(id, dto);
  }
}
