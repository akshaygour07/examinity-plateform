import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { EligibilityService } from "./eligibility.service";
@Controller()
export class EligibilityController {
  constructor(private readonly service: EligibilityService) {}
  /**
   * Get published eligibility configuration. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Get published eligibility configuration",
    description:
      "Get published eligibility configuration. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/eligibility")
  publicConfig(@Param("cycleId") id: string) {
    return this.service.publicConfig(id);
  }
  /**
   * Get the eligibility profile for a cycle. Requires the exam.eligibility.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "Get the eligibility profile for a cycle",
    description:
      "Get the eligibility profile for a cycle. Requires the exam.eligibility.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/eligibility")
  @RequirePermissions("exam.eligibility.read")
  adminProfile(@Param("cycleId") id: string) {
    return this.service.adminProfile(id);
  }
  /**
   * Create an eligibility profile. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an eligibility profile",
    description:
      "Create an eligibility profile. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/eligibility")
  @RequirePermissions("exam.eligibility.manage")
  create(@Param("cycleId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.create(id, d);
  }
  /**
   * Create an eligibility version. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an eligibility version",
    description:
      "Create an eligibility version. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/eligibility-profiles/:profileId/versions")
  @RequirePermissions("exam.eligibility.manage")
  version(@Param("profileId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.createVersion(id, d);
  }
  /**
   * Get an eligibility version. Requires the exam.eligibility.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get an eligibility version",
    description:
      "Get an eligibility version. Requires the exam.eligibility.read permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Get("admin/eligibility-versions/:versionId")
  @RequirePermissions("exam.eligibility.read")
  getVersion(@Param("versionId") id: string) {
    return this.service.getVersion(id);
  }
  /**
   * Replace eligibility inputs. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Replace eligibility inputs",
    description:
      "Replace eligibility inputs. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Put("admin/eligibility-versions/:versionId/inputs")
  @RequirePermissions("exam.eligibility.manage")
  inputs(@Param("versionId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.inputs(id, d);
  }
  /**
   * Replace eligibility rules. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Replace eligibility rules",
    description:
      "Replace eligibility rules. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Put("admin/eligibility-versions/:versionId/rules")
  @RequirePermissions("exam.eligibility.manage")
  rules(@Param("versionId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.rules(id, d);
  }
  /**
   * Validate an eligibility version. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Validate an eligibility version",
    description:
      "Validate an eligibility version. Requires the exam.eligibility.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/eligibility-versions/:versionId/validate")
  @RequirePermissions("exam.eligibility.manage")
  validate(@Param("versionId") id: string) {
    return this.service.validate(id);
  }
  /**
   * Check public eligibility criteria. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "Check public eligibility criteria",
    description:
      "Check public eligibility criteria. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Post("public/exam-cycles/:cycleId/eligibility/check")
  check(@Param("cycleId") id: string, @Body() d: Record<string, unknown>) {
    return this.service.check(id, d);
  }
}
