import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { ExamPatternService } from "./exam-pattern.service";
@Controller()
export class ExamPatternController {
  constructor(private readonly service: ExamPatternService) {}
  /**
   * Get the published exam pattern. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get the published exam pattern",
    description: "Get the published exam pattern. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/pattern")
  publicPattern(@Param("cycleId") id: string) {
    return this.service.cyclePattern(id, true);
  }
  /**
   * Get the exam pattern for a cycle. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Get the exam pattern for a cycle",
    description:
      "Get the exam pattern for a cycle. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/pattern")
  @RequirePermissions("exam.pattern.manage")
  adminPattern(@Param("cycleId") id: string) {
    return this.service.cyclePattern(id);
  }
  /**
   * Get an exam pattern version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Get an exam pattern version",
    description:
      "Get an exam pattern version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/pattern-versions/:versionId")
  @RequirePermissions("exam.pattern.manage")
  version(@Param("versionId") id: string) {
    return this.service.version(id);
  }
  /**
   * Create an exam pattern version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam pattern version",
    description:
      "Create an exam pattern version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/pattern-versions")
  @RequirePermissions("exam.pattern.manage")
  create(@Param("cycleId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.create(id, d);
  }
  /**
   * Add a stage to an exam pattern. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Add a stage to an exam pattern",
    description:
      "Add a stage to an exam pattern. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/pattern-versions/:versionId/stages")
  @RequirePermissions("exam.pattern.manage")
  stage(@Param("versionId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.stage(id, d);
  }
  /**
   * Update an exam pattern stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam pattern stage",
    description:
      "Update an exam pattern stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-stages/:stageId")
  @RequirePermissions("exam.pattern.manage")
  updateStage(@Param("stageId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.updateStage(id, d);
  }
  /**
   * Delete an exam pattern stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Delete an exam pattern stage",
    description:
      "Delete an exam pattern stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Delete("admin/exam-stages/:stageId")
  @RequirePermissions("exam.pattern.manage")
  deleteStage(@Param("stageId") id: string) {
    return this.service.deleteStage(id);
  }
  /**
   * Add a paper to an exam pattern stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Add a paper to an exam pattern stage",
    description:
      "Add a paper to an exam pattern stage. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-stages/:stageId/papers")
  @RequirePermissions("exam.pattern.manage")
  paper(@Param("stageId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.paper(id, d);
  }
  /**
   * Update an exam pattern paper. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam pattern paper",
    description:
      "Update an exam pattern paper. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-papers/:paperId")
  @RequirePermissions("exam.pattern.manage")
  updatePaper(@Param("paperId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.updatePaper(id, d);
  }
  /**
   * Reorder exam pattern stages. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Reorder exam pattern stages",
    description:
      "Reorder exam pattern stages. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Put("admin/exam-patterns/:versionId/reorder")
  @RequirePermissions("exam.pattern.manage")
  reorder(@Param("versionId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.reorder(id, d);
  }
  /**
   * Validate an exam pattern version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Validate an exam pattern version",
    description:
      "Validate an exam pattern version. Requires the exam.pattern.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-patterns/:versionId/validate")
  @RequirePermissions("exam.pattern.manage")
  validate(@Param("versionId") id: string) {
    return this.service.validate(id);
  }
}
