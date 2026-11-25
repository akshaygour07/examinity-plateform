import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import type { AuthenticatedRequest } from "../../auth/auth0.guard";
import { auditRequest } from "../../common/request-context";
import { CancelEventDto, EventDto, EventRevisionDto } from "./dto/event.dto";
import { EventsService } from "./events.service";
@Controller()
export class EventsController {
  constructor(private readonly service: EventsService) {}
  /**
   * List public exam events. This public endpoint returns only data allowed by the publication and visibility rules.
   */
  @ApiOperation({
    summary: "List public exam events",
    description: "List public exam events. This public endpoint returns only data allowed by the publication and visibility rules.",
  })
  @Get("public/exam-cycles/:cycleId/events")
  publicList(@Param("cycleId") id: string) {
    return this.service.list(id, true);
  }
  /**
   * List exam events for a cycle. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @ApiOperation({
    summary: "List exam events for a cycle",
    description:
      "List exam events for a cycle. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/events")
  @RequirePermissions("exam.events.manage")
  list(@Param("cycleId") id: string) {
    return this.service.list(id);
  }
  /**
   * Create an exam event. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an exam event",
    description:
      "Create an exam event. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-cycles/:cycleId/events")
  @RequirePermissions("exam.events.manage")
  create(@Param("cycleId") id: string, @Body() d: EventDto) {
    return this.service.create(id, d);
  }
  /**
   * Update an exam event. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update an exam event",
    description:
      "Update an exam event. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Patch("admin/exam-events/:eventId")
  @RequirePermissions("exam.events.manage")
  update(@Param("eventId") id: string, @Body() d: EventDto) {
    return this.service.update(id, d);
  }
  /**
   * Create an event revision. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create an event revision",
    description:
      "Create an event revision. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-events/:eventId/revisions")
  @RequirePermissions("exam.events.manage")
  revise(@Param("eventId") id: string, @Body() d: EventRevisionDto) {
    return this.service.revise(id, d);
  }
  /**
   * Cancel an exam event. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.
   */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Cancel an exam event",
    description:
      "Cancel an exam event. Requires the exam.events.manage permission and an authenticated Auth0 bearer token. Administrative requests must satisfy the configured admin application and MFA policy.",
  })
  @Post("admin/exam-events/:eventId/cancel")
  @RequirePermissions("exam.events.manage")
  cancel(@Param("eventId") id: string, @Body() d: CancelEventDto) {
    return this.service.cancel(id, d);
  }

  /** Approve a proposed event revision after review. */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Approve an event revision",
    description: "Moves a pending event revision to review-approved. Requires the exam.review permission.",
  })
  @Post("admin/exam-event-revisions/:revisionId/approve")
  @RequirePermissions("exam.review")
  approveRevision(@Param("revisionId") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.transitionRevision(id, "approve", request.principal!.id, auditRequest(request));
  }

  /** Verify a reviewed event revision against its official source. */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Verify an event revision",
    description: "Verifies a reviewed event revision with source evidence. Requires the exam.verify permission.",
  })
  @Post("admin/exam-event-revisions/:revisionId/verify")
  @RequirePermissions("exam.verify")
  verifyRevision(@Param("revisionId") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.transitionRevision(id, "verify", request.principal!.id, auditRequest(request));
  }

  /** Publish a verified event revision and apply its dates/status to the public event. */
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Publish an event revision",
    description: "Publishes a verified event revision and applies its approved values. Requires the exam.publish permission.",
  })
  @Post("admin/exam-event-revisions/:revisionId/publish")
  @RequirePermissions("exam.publish")
  publishRevision(@Param("revisionId") id: string, @Req() request: AuthenticatedRequest) {
    return this.service.transitionRevision(id, "publish", request.principal!.id, auditRequest(request));
  }
}
