import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { CreateSelectionProcessDto, SelectionStageDto } from "./dto/selection-process.dto";
import { SelectionProcessService } from "./selection-process.service";
@Controller()
export class SelectionProcessController {
  constructor(private readonly service: SelectionProcessService) {}
  /**
   * Get the published selection process for a cycle. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get the published selection process for a cycle",
    description:
      "Get the published selection process for a cycle. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/selection-process")
  pub(@Param("cycleId") id: string) {
    return this.service.list(id, true);
  }
  /**
   * Get the selection process for a cycle. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Get the selection process for a cycle",
    description:
      "Get the selection process for a cycle. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/selection-process")
  @RequirePermissions("exam.pattern.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * Create a selection process version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create a selection process version",
    description:
      "Create a selection process version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/selection-process")
  @RequirePermissions("exam.pattern.manage")
  create(@Param("cycleId") id: string, @Body() d: CreateSelectionProcessDto) {
    return this.service.create(id, d);
  }
  /**
   * Add a selection process stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Add a selection process stage",
    description:
      "Add a selection process stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/selection-process/:versionId/stages")
  @RequirePermissions("exam.pattern.manage")
  stage(@Param("versionId") id: string, @Body() d: SelectionStageDto) {
    return this.service.addStage(id, d);
  }
  /**
   * Update a selection process stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update a selection process stage",
    description:
      "Update a selection process stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/selection-stages/:stageId")
  @RequirePermissions("exam.pattern.manage")
  update(@Param("stageId") id: string, @Body() d: SelectionStageDto) {
    return this.service.updateStage(id, d);
  }
}
