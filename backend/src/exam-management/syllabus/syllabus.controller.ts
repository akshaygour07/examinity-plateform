import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RequirePermissions } from "../../auth/authorization";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import {
  CreateSyllabusDto,
  CreateSyllabusVersionDto,
  CreateSyllabusStageDto,
  CreateSyllabusPaperDto,
  CreateSyllabusSubjectDto,
  CreateSyllabusTopicDto,
  UpdateSyllabusTopicDto,
} from "./dto/syllabus.dto";
import { SyllabusService } from "./syllabus.service";
@Controller()
export class SyllabusController {
  constructor(private readonly service: SyllabusService) {}
  /**
   * Get the published syllabus for a cycle. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get the published syllabus for a cycle",
    description:
      "Get the published syllabus for a cycle. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/syllabus")
  publicSyllabus(@Param("cycleId") id: string) {
    return this.service.publicByCycle(id);
  }
  /**
   * Get a published syllabus version. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get a published syllabus version",
    description:
      "Get a published syllabus version. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/syllabus-versions/:versionId")
  publicVersion(@Param("versionId") id: string) {
    return this.service.publicVersion(id);
  }
  /**
   * Get syllabus versions for a cycle. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Get syllabus versions for a cycle",
    description:
      "Get syllabus versions for a cycle. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/syllabus")
  @RequirePermissions("exam.syllabus.manage")
  adminByCycle(@Param("cycleId") id: string) {
    return this.service.adminByCycle(id);
  }
  /**
   * Create a syllabus for a cycle. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Create a syllabus for a cycle",
    description:
      "Create a syllabus for a cycle. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/exam-cycles/:cycleId/syllabus")
  @RequirePermissions("exam.syllabus.manage")
  createSyllabus(@Param("cycleId") id: string, @Body() dto: CreateSyllabusDto) {
    return this.service.createSyllabus(id, dto);
  }
  /**
   * Create a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Create a syllabus version",
    description:
      "Create a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabuses/:syllabusId/versions")
  @RequirePermissions("exam.syllabus.manage")
  createVersion(@Param("syllabusId") id: string, @Body() dto: CreateSyllabusVersionDto) {
    return this.service.createVersion(id, dto);
  }
  /**
   * Get a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Get a syllabus version",
    description:
      "Get a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/syllabus-versions/:versionId")
  @RequirePermissions("exam.syllabus.manage")
  adminVersion(@Param("versionId") id: string) {
    return this.service.adminVersion(id);
  }
  /**
   * Add a syllabus stage. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Add a syllabus stage",
    description:
      "Add a syllabus stage. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-versions/:versionId/stages")
  @RequirePermissions("exam.syllabus.manage")
  addStage(@Param("versionId") id: string, @Body() dto: CreateSyllabusStageDto) {
    return this.service.addStage(id, dto);
  }
  /**
   * Add a syllabus paper. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Add a syllabus paper",
    description:
      "Add a syllabus paper. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-stages/:stageId/papers")
  @RequirePermissions("exam.syllabus.manage")
  addPaper(@Param("stageId") id: string, @Body() dto: CreateSyllabusPaperDto) {
    return this.service.addPaper(id, dto);
  }
  /**
   * Add a syllabus subject. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Add a syllabus subject",
    description:
      "Add a syllabus subject. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-papers/:paperId/subjects")
  @RequirePermissions("exam.syllabus.manage")
  addSubject(@Param("paperId") id: string, @Body() dto: CreateSyllabusSubjectDto) {
    return this.service.addSubject(id, dto);
  }
  /**
   * Add a syllabus topic. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Add a syllabus topic",
    description:
      "Add a syllabus topic. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-subjects/:subjectId/topics")
  @RequirePermissions("exam.syllabus.manage")
  addTopic(@Param("subjectId") id: string, @Body() dto: CreateSyllabusTopicDto) {
    return this.service.addTopic(id, dto);
  }
  /**
   * Update a syllabus topic. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Update a syllabus topic",
    description:
      "Update a syllabus topic. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Patch("admin/syllabus-topics/:topicId")
  @RequirePermissions("exam.syllabus.manage")
  updateTopic(@Param("topicId") id: string, @Body() dto: UpdateSyllabusTopicDto) {
    return this.service.updateTopic(id, dto);
  }
  /**
   * Add a child syllabus topic. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Add a child syllabus topic",
    description:
      "Add a child syllabus topic. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-topics/:topicId/children")
  @RequirePermissions("exam.syllabus.manage")
  addChild(@Param("topicId") id: string, @Body() dto: CreateSyllabusTopicDto) {
    return this.service.addChild(id, dto);
  }
  /**
   * Validate a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Validate a syllabus version",
    description:
      "Validate a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-versions/:versionId/validate")
  @RequirePermissions("exam.syllabus.manage")
  validate(@Param("versionId") id: string) {
    return this.service.validate(id);
  }
  /**
   * Publish a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Publish a syllabus version",
    description:
      "Publish a syllabus version. Requires the exam.syllabus.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Post("admin/syllabus-versions/:versionId/publish")
  @RequirePermissions("exam.syllabus.manage")
  publish(@Param("versionId") id: string) {
    return this.service.publish(id);
  }
}
