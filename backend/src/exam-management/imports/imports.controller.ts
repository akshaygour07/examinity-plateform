import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../../auth/authorization";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { CreateImportJobDto } from "./dto/create-import-job.dto";
import { ImportsService } from "./imports.service";

@ApiTags("Module 2 imports and publishing")
@Controller()
@UseGuards(Auth0Guard, AuthorizationGuard)
@ApiBearerAuth()
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  /** Create an import job for a previously uploaded source file. */
  @ApiOperation({
    summary: "Create an import job",
    description: "Creates an examination import job for an uploaded media file. Requires the exam.import permission.",
  })
  @Post("admin/exam-imports")
  @RequirePermissions("exam.import")
  create(@Body() dto: CreateImportJobDto) {
    return this.service.create(dto);
  }

  /** Read an import job and its associated rows. */
  @ApiOperation({
    summary: "Get an import job",
    description: "Returns an import job with its rows. Requires the exam.import permission.",
  })
  @Get("admin/exam-imports/:jobId")
  @RequirePermissions("exam.import")
  get(@Param("jobId") id: string) {
    return this.service.get(id);
  }

  /** List rows with validation errors for an import job. */
  @ApiOperation({
    summary: "Get import validation errors",
    description: "Returns rows that contain validation errors. Requires the exam.import permission.",
  })
  @Get("admin/exam-imports/:jobId/errors")
  @RequirePermissions("exam.import")
  errors(@Param("jobId") id: string) {
    return this.service.errors(id);
  }

  /** Commit a validated import job. */
  @ApiOperation({
    summary: "Commit an import job",
    description: "Commits an import job that has not already been committed. Requires the exam.import permission.",
  })
  @Post("admin/exam-imports/:jobId/commit")
  @RequirePermissions("exam.import")
  commit(@Param("jobId") id: string) {
    return this.service.commit(id);
  }

  /** List import jobs and content waiting in the publishing workflow. */
  @ApiOperation({
    summary: "Get the publishing queue",
    description: "Returns pending and validated import jobs awaiting processing. Requires the exam.review permission.",
  })
  @Get("admin/publishing/queue")
  @RequirePermissions("exam.review")
  queue() {
    return this.service.queue();
  }

  /** Submit draft examination content for review. */
  @ApiOperation({
    summary: "Submit content for review",
    description: "Submits registered examination content for review. Requires the exam.review permission.",
  })
  @Post("admin/exam-content/:contentId/submit-review")
  @RequirePermissions("exam.review")
  submitReview(@Param("contentId") id: string) {
    return this.service.action(id, "submit-review");
  }

  /** Approve examination content after review. */
  @ApiOperation({
    summary: "Approve reviewed content",
    description: "Approves registered examination content after review. Requires the exam.review permission.",
  })
  @Post("admin/exam-content/:contentId/approve-review")
  @RequirePermissions("exam.review")
  approveReview(@Param("contentId") id: string) {
    return this.service.action(id, "approve-review");
  }

  /** Verify examination content against its official source. */
  @ApiOperation({
    summary: "Verify content",
    description: "Verifies registered examination content against its official source. Requires the exam.verify permission.",
  })
  @Post("admin/exam-content/:contentId/verify")
  @RequirePermissions("exam.verify")
  verify(@Param("contentId") id: string) {
    return this.service.action(id, "verify");
  }

  /** Publish verified examination content. */
  @ApiOperation({
    summary: "Publish content",
    description: "Publishes registered and verified examination content. Requires the exam.publish permission.",
  })
  @Post("admin/exam-content/:contentId/publish")
  @RequirePermissions("exam.publish")
  publish(@Param("contentId") id: string) {
    return this.service.action(id, "publish");
  }

  /** Unpublish examination content through the controlled workflow. */
  @ApiOperation({
    summary: "Unpublish content",
    description: "Unpublishes registered examination content through the controlled workflow. Requires the exam.unpublish permission.",
  })
  @Post("admin/exam-content/:contentId/unpublish")
  @RequirePermissions("exam.unpublish")
  unpublish(@Param("contentId") id: string) {
    return this.service.action(id, "unpublish");
  }

  /** Archive examination content. */
  @ApiOperation({
    summary: "Archive content",
    description: "Archives registered examination content. Requires the exam.catalogue.archive permission.",
  })
  @Post("admin/exam-content/:contentId/archive")
  @RequirePermissions("exam.catalogue.archive")
  archive(@Param("contentId") id: string) {
    return this.service.action(id, "archive");
  }
}
