import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { AliasDto, BodyDto, CycleDto, ExamDto, ExamQueryDto, TaxonomyDto } from "./dto/exam-management.dto";
import { ExamsService } from "./exams.service";

@ApiTags("Module 2 examination management")
@Controller()
export class ExamsController {
  constructor(private readonly service: ExamsService) {}
  /**
   * List public exam categories. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam categories",
    description: "List public exam categories. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-categories")
  publicCategories() {
    return this.service.listTaxonomy("category", true);
  }
  /**
   * List public exam groups. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam groups",
    description: "List public exam groups. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-groups")
  publicGroups() {
    return this.service.listTaxonomy("group", true);
  }
  /**
   * List public states. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public states",
    description: "List public states. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/states")
  publicStates() {
    return this.service.states(true);
  }
  /**
   * List public exam authorities. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam authorities",
    description: "List public exam authorities. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-bodies")
  publicBodies() {
    return this.service.bodies(true);
  }
  /**
   * List public examinations. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public examinations",
    description: "List public examinations. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams")
  publicExams(@Query() q: ExamQueryDto) {
    return this.service.listExams(q, true);
  }
  /**
   * Search public examinations. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Search public examinations",
    description: "Search public examinations. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/search")
  publicSearch(@Query() q: ExamQueryDto) {
    return this.service.listExams(q, true);
  }
  /**
   * List related public examinations. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List related public examinations",
    description:
      "List related public examinations. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/:examId/related")
  publicRelated(@Param("examId") id: string) {
    return this.service.relatedExams(id);
  }
  /**
   * Get public examination details. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get public examination details",
    description: "Get public examination details. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/:slug")
  publicExam(@Param("slug") slug: string) {
    return this.service.getExam(slug, true);
  }
  /**
   * List public examination cycles. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public examination cycles",
    description: "List public examination cycles. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exams/:examId/cycles")
  publicCycles(@Param("examId") id: string) {
    return this.service.cycles(id, true);
  }
  /**
   * Get public examination cycle. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get public examination cycle",
    description: "Get public examination cycle. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId")
  publicCycle(@Param("cycleId") id: string) {
    return this.service.getCycle(id, true);
  }

  /**
   * List exam categories. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List exam categories",
    description:
      "List exam categories. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-categories")
  @RequirePermissions("exam.taxonomy.read")
  categories() {
    return this.service.listTaxonomy("category");
  }
  /**
   * Get an exam category. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get an exam category",
    description:
      "Get an exam category. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exam-categories/:id")
  @RequirePermissions("exam.taxonomy.read")
  category(@Param("id") id: string) {
    return this.service.taxonomyDetail("category", id);
  }
  /**
   * Create an exam category. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam category",
    description:
      "Create an exam category. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-categories")
  @RequirePermissions("exam.taxonomy.manage")
  createCategory(@Body() d: TaxonomyDto, @Req() r: AuthenticatedRequest) {
    return this.service.createTaxonomy("category", d, r.principal!);
  }
  /**
   * Update an exam category. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam category",
    description:
      "Update an exam category. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-categories/:id")
  @RequirePermissions("exam.taxonomy.manage")
  updateCategory(@Param("id") id: string, @Body() d: TaxonomyDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateTaxonomy("category", id, d, r.principal!);
  }
  /**
   * Archive an exam category. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Archive an exam category",
    description:
      "Archive an exam category. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-categories/:id/archive")
  @RequirePermissions("exam.taxonomy.manage")
  archiveCategory(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return this.service.archiveTaxonomy("category", id, r.principal!);
  }
  /**
   * List exam groups. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List exam groups",
    description:
      "List exam groups. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exam-groups")
  @RequirePermissions("exam.taxonomy.read")
  groups() {
    return this.service.listTaxonomy("group");
  }
  /**
   * Create an exam group. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam group",
    description:
      "Create an exam group. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-groups")
  @RequirePermissions("exam.taxonomy.manage")
  createGroup(@Body() d: TaxonomyDto, @Req() r: AuthenticatedRequest) {
    return this.service.createTaxonomy("group", d, r.principal!);
  }
  /**
   * Update an exam group. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam group",
    description:
      "Update an exam group. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-groups/:id")
  @RequirePermissions("exam.taxonomy.manage")
  updateGroup(@Param("id") id: string, @Body() d: TaxonomyDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateTaxonomy("group", id, d, r.principal!);
  }
  /**
   * Archive an exam group. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Archive an exam group",
    description:
      "Archive an exam group. Requires the exam.taxonomy.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-groups/:id/archive")
  @RequirePermissions("exam.taxonomy.manage")
  archiveGroup(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return this.service.archiveTaxonomy("group", id, r.principal!);
  }
  /**
   * List states. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List states",
    description:
      "List states. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/states")
  @RequirePermissions("exam.taxonomy.read")
  states() {
    return this.service.states();
  }
  /**
   * List exam authorities. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List exam authorities",
    description:
      "List exam authorities. Requires the exam.taxonomy.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exam-bodies")
  @RequirePermissions("exam.taxonomy.read")
  bodies() {
    return this.service.bodies();
  }
  /**
   * Create an exam authority. Requires the exam.authority.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam authority",
    description:
      "Create an exam authority. Requires the exam.authority.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-bodies")
  @RequirePermissions("exam.authority.manage")
  createBody(@Body() d: BodyDto, @Req() r: AuthenticatedRequest) {
    return this.service.createBody(d, r.principal!);
  }
  /**
   * Update an exam authority. Requires the exam.authority.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam authority",
    description:
      "Update an exam authority. Requires the exam.authority.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-bodies/:id")
  @RequirePermissions("exam.authority.manage")
  updateBody(@Param("id") id: string, @Body() d: BodyDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateBody(id, d, r.principal!);
  }
  /**
   * List examinations. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List examinations",
    description:
      "List examinations. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams")
  @RequirePermissions("exam.catalogue.read")
  exams(@Query() q: ExamQueryDto) {
    return this.service.listExams(q);
  }
  /**
   * Create an examination. Requires the exam.catalogue.create permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an examination",
    description:
      "Create an examination. Requires the exam.catalogue.create permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams")
  @RequirePermissions("exam.catalogue.create")
  createExam(@Body() d: ExamDto, @Req() r: AuthenticatedRequest) {
    return this.service.createExam(d, r.principal!);
  }
  /**
   * Get examination details. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get examination details",
    description:
      "Get examination details. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams/:id")
  @RequirePermissions("exam.catalogue.read")
  exam(@Param("id") id: string) {
    return this.service.getExam(id);
  }
  /**
   * Export examination and cycle data as an XLSX workbook. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Export examination and cycle data as an XLSX workbook",
    description:
      "Export examination and cycle data as an XLSX workbook. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams/:id/export.xlsx")
  @RequirePermissions("exam.catalogue.read")
  async exportWorkbook(@Param("id") id: string, @Res() response: Response) {
    const workbook = await this.service.exportWorkbook(id);
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="examinity-${id}.xlsx"`);
    response.send(workbook);
  }
  /**
   * Update an examination. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an examination",
    description:
      "Update an examination. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exams/:id")
  @RequirePermissions("exam.catalogue.update")
  updateExam(@Param("id") id: string, @Body() d: ExamDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateExam(id, d, r.principal!);
  }
  /**
   * Activate an examination. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Activate an examination",
    description:
      "Activate an examination. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:id/activate")
  @RequirePermissions("exam.catalogue.update")
  activateExam(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return this.service.setExamStatus(id, "ACTIVE", r.principal!);
  }
  /**
   * Deactivate an examination. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Deactivate an examination",
    description:
      "Deactivate an examination. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:id/deactivate")
  @RequirePermissions("exam.catalogue.update")
  deactivateExam(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return this.service.setExamStatus(id, "INACTIVE", r.principal!);
  }
  /**
   * Archive an examination. Requires the exam.catalogue.archive permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Archive an examination",
    description:
      "Archive an examination. Requires the exam.catalogue.archive permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:id/archive")
  @RequirePermissions("exam.catalogue.archive")
  archiveExam(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return this.service.setExamStatus(id, "ARCHIVED", r.principal!);
  }
  /**
   * List examination aliases. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List examination aliases",
    description:
      "List examination aliases. Requires the exam.catalogue.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams/:id/aliases")
  @RequirePermissions("exam.catalogue.read")
  aliases(@Param("id") id: string) {
    return this.service.aliases(id);
  }
  /**
   * Add an examination alias. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Add an examination alias",
    description:
      "Add an examination alias. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:id/aliases")
  @RequirePermissions("exam.catalogue.update")
  addAlias(@Param("id") id: string, @Body() d: AliasDto, @Req() r: AuthenticatedRequest) {
    return this.service.addAlias(id, d, r.principal!);
  }
  /**
   * Remove an examination alias. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Remove an examination alias",
    description:
      "Remove an examination alias. Requires the exam.catalogue.update permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Delete("admin/exams/:id/aliases/:aliasId")
  @RequirePermissions("exam.catalogue.update")
  removeAlias(@Param("id") id: string, @Param("aliasId") aliasId: string, @Req() r: AuthenticatedRequest) {
    return this.service.removeAlias(id, aliasId, r.principal!);
  }
  /**
   * List examination cycles. Requires the exam.cycle.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List examination cycles",
    description:
      "List examination cycles. Requires the exam.cycle.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exams/:id/cycles")
  @RequirePermissions("exam.cycle.read")
  cycles(@Param("id") id: string) {
    return this.service.cycles(id);
  }
  /**
   * Create an examination cycle. Requires the exam.cycle.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an examination cycle",
    description:
      "Create an examination cycle. Requires the exam.cycle.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exams/:id/cycles")
  @RequirePermissions("exam.cycle.manage")
  createCycle(@Param("id") id: string, @Body() d: CycleDto, @Req() r: AuthenticatedRequest) {
    return this.service.createCycle(id, d, r.principal!);
  }
  /**
   * Get examination cycle details. Requires the exam.cycle.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get examination cycle details",
    description:
      "Get examination cycle details. Requires the exam.cycle.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/exam-cycles/:id")
  @RequirePermissions("exam.cycle.read")
  cycle(@Param("id") id: string) {
    return this.service.getCycle(id);
  }
  /**
   * Update an examination cycle. Requires the exam.cycle.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an examination cycle",
    description:
      "Update an examination cycle. Requires the exam.cycle.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-cycles/:id")
  @RequirePermissions("exam.cycle.manage")
  updateCycle(@Param("id") id: string, @Body() d: CycleDto, @Req() r: AuthenticatedRequest) {
    return this.service.updateCycle(id, d, r.principal!);
  }
  /**
   * Archive an examination cycle. Requires the exam.cycle.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Archive an examination cycle",
    description:
      "Archive an examination cycle. Requires the exam.cycle.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:id/archive")
  @RequirePermissions("exam.cycle.manage")
  archiveCycle(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return this.service.archiveCycle(id, r.principal!);
  }
}
