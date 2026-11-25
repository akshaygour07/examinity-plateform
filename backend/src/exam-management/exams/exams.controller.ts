import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
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
  @Get("public/exam-categories") publicCategories() {
    return this.service.listTaxonomy("category", true);
  }
  @Get("public/exam-groups") publicGroups() {
    return this.service.listTaxonomy("group", true);
  }
  @Get("public/states") publicStates() {
    return this.service.states(true);
  }
  @Get("public/exam-bodies") publicBodies() {
    return this.service.bodies(true);
  }
  @Get("public/exams") publicExams(@Query() q: ExamQueryDto) {
    return this.service.listExams(q, true);
  }
  @Get("public/exams/search") publicSearch(@Query() q: ExamQueryDto) {
    return this.service.listExams(q, true);
  }
  @Get("public/exams/:slug") publicExam(@Param("slug") slug: string) {
    return this.service.getExam(slug, true);
  }
  @Get("public/exams/:examId/cycles") publicCycles(@Param("examId") id: string) {
    return this.service.cycles(id, true);
  }
  @Get("public/exam-cycles/:cycleId") publicCycle(@Param("cycleId") id: string) {
    return this.service.getCycle(id, true);
  }

  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-categories")
  @RequirePermissions("exam.taxonomy.read")
  categories() {
    return this.service.listTaxonomy("category");
  }
  @Post("admin/exam-categories") @RequirePermissions("exam.taxonomy.manage") createCategory(
    @Body() d: TaxonomyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.createTaxonomy("category", d, r.principal!);
  }
  @Patch("admin/exam-categories/:id") @RequirePermissions("exam.taxonomy.manage") updateCategory(
    @Param("id") id: string,
    @Body() d: TaxonomyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.updateTaxonomy("category", id, d, r.principal!);
  }
  @Post("admin/exam-categories/:id/archive") @RequirePermissions("exam.taxonomy.manage") archiveCategory(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.archiveTaxonomy("category", id, r.principal!);
  }
  @Get("admin/exam-groups") @RequirePermissions("exam.taxonomy.read") groups() {
    return this.service.listTaxonomy("group");
  }
  @Post("admin/exam-groups") @RequirePermissions("exam.taxonomy.manage") createGroup(
    @Body() d: TaxonomyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.createTaxonomy("group", d, r.principal!);
  }
  @Patch("admin/exam-groups/:id") @RequirePermissions("exam.taxonomy.manage") updateGroup(
    @Param("id") id: string,
    @Body() d: TaxonomyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.updateTaxonomy("group", id, d, r.principal!);
  }
  @Post("admin/exam-groups/:id/archive") @RequirePermissions("exam.taxonomy.manage") archiveGroup(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.archiveTaxonomy("group", id, r.principal!);
  }
  @Get("admin/states") @RequirePermissions("exam.taxonomy.read") states() {
    return this.service.states();
  }
  @Get("admin/exam-bodies") @RequirePermissions("exam.taxonomy.read") bodies() {
    return this.service.bodies();
  }
  @Post("admin/exam-bodies") @RequirePermissions("exam.authority.manage") createBody(@Body() d: BodyDto, @Req() r: AuthenticatedRequest) {
    return this.service.createBody(d, r.principal!);
  }
  @Patch("admin/exam-bodies/:id") @RequirePermissions("exam.authority.manage") updateBody(
    @Param("id") id: string,
    @Body() d: BodyDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.updateBody(id, d, r.principal!);
  }
  @Get("admin/exams") @RequirePermissions("exam.catalogue.read") exams(@Query() q: ExamQueryDto) {
    return this.service.listExams(q);
  }
  @Post("admin/exams") @RequirePermissions("exam.catalogue.create") createExam(@Body() d: ExamDto, @Req() r: AuthenticatedRequest) {
    return this.service.createExam(d, r.principal!);
  }
  @Get("admin/exams/:id") @RequirePermissions("exam.catalogue.read") exam(@Param("id") id: string) {
    return this.service.getExam(id);
  }
  @Get("admin/exams/:id/export.xlsx") @RequirePermissions("exam.catalogue.read") async exportWorkbook(@Param("id") id: string, @Res() response: Response) {
    const workbook = await this.service.exportWorkbook(id);
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition", `attachment; filename="examinity-${id}.xlsx"`);
    response.send(workbook);
  }
  @Patch("admin/exams/:id") @RequirePermissions("exam.catalogue.update") updateExam(
    @Param("id") id: string,
    @Body() d: ExamDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.updateExam(id, d, r.principal!);
  }
  @Post("admin/exams/:id/activate") @RequirePermissions("exam.catalogue.update") activateExam(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.setExamStatus(id, "ACTIVE", r.principal!);
  }
  @Post("admin/exams/:id/deactivate") @RequirePermissions("exam.catalogue.update") deactivateExam(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.setExamStatus(id, "INACTIVE", r.principal!);
  }
  @Post("admin/exams/:id/archive") @RequirePermissions("exam.catalogue.archive") archiveExam(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.setExamStatus(id, "ARCHIVED", r.principal!);
  }
  @Get("admin/exams/:id/aliases") @RequirePermissions("exam.catalogue.read") aliases(@Param("id") id: string) {
    return this.service.aliases(id);
  }
  @Post("admin/exams/:id/aliases") @RequirePermissions("exam.catalogue.update") addAlias(
    @Param("id") id: string,
    @Body() d: AliasDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.addAlias(id, d, r.principal!);
  }
  @Delete("admin/exams/:id/aliases/:aliasId") @RequirePermissions("exam.catalogue.update") removeAlias(
    @Param("id") id: string,
    @Param("aliasId") aliasId: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.removeAlias(id, aliasId, r.principal!);
  }
  @Get("admin/exams/:id/cycles") @RequirePermissions("exam.cycle.read") cycles(@Param("id") id: string) {
    return this.service.cycles(id);
  }
  @Post("admin/exams/:id/cycles") @RequirePermissions("exam.cycle.manage") createCycle(
    @Param("id") id: string,
    @Body() d: CycleDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.createCycle(id, d, r.principal!);
  }
  @Get("admin/exam-cycles/:id") @RequirePermissions("exam.cycle.read") cycle(@Param("id") id: string) {
    return this.service.getCycle(id);
  }
  @Patch("admin/exam-cycles/:id") @RequirePermissions("exam.cycle.manage") updateCycle(
    @Param("id") id: string,
    @Body() d: CycleDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.updateCycle(id, d, r.principal!);
  }
  @Post("admin/exam-cycles/:id/archive") @RequirePermissions("exam.cycle.manage") archiveCycle(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.archiveCycle(id, r.principal!);
  }
}
