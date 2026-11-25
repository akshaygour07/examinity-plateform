import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { auditRequest } from "../common/request-context";
import { Auth0Guard, type AuthenticatedRequest } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";
import { SessionsService } from "./sessions.service";
import { RevokeOtherSessionsDto } from "./revoke-others.dto";

@ApiTags("admin sessions (ADM-018)")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("me/sessions")
/** Admin aliases for the shared Module 1 API-session service. Ownership always comes from the validated principal. */
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @RequirePermissions("admin.sessions.view")
  @ApiOperation({ summary: "List the signed-in administrator's Examinity API sessions" })
  @ApiResponse({ status: 200, description: "Recent active sessions and sessions revoked in the last 30 days." })
  list(@Req() request: AuthenticatedRequest) {
    return this.sessions.list(request.principal!.id, request.apiSession?.id, auditRequest(request));
  }

  @Get(":sessionId")
  @RequirePermissions("admin.sessions.view")
  @ApiOperation({ summary: "Read one session owned by the signed-in administrator" })
  get(@Req() request: AuthenticatedRequest, @Param("sessionId", new ParseUUIDPipe()) sessionId: string) {
    return this.sessions.get(request.principal!.id, sessionId, request.apiSession?.id);
  }

  @Delete(":sessionId")
  @RequirePermissions("admin.sessions.revoke")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke one of the signed-in administrator's API sessions" })
  revoke(@Req() request: AuthenticatedRequest, @Param("sessionId", new ParseUUIDPipe()) sessionId: string) {
    const principal = request.principal!;
    return this.sessions.revoke(principal.id, principal.id, sessionId, auditRequest(request));
  }

  @Post("revoke-others")
  @RequirePermissions("admin.sessions.revoke")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RevokeOtherSessionsDto })
  @ApiOperation({ summary: "Revoke all other API sessions and preserve the current session" })
  revokeOthers(@Req() request: AuthenticatedRequest, @Body() body: RevokeOtherSessionsDto) {
    void body;
    const principal = request.principal!;
    return this.sessions.revokeOthers(principal.id, principal.id, request.apiSession?.id, auditRequest(request));
  }
}

@ApiTags("authentication and identity")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("auth/me/sessions")
/** Shared self-service API-session operations for any active, verified Module 1 user. */
export class MySessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  @ApiOperation({ summary: "List the signed-in user's Examinity API sessions" })
  list(@Req() request: AuthenticatedRequest) {
    return this.sessions.list(request.principal!.id, request.apiSession?.id, auditRequest(request));
  }

  @Get(":sessionId")
  @ApiOperation({ summary: "Read one session owned by the signed-in user" })
  get(@Req() request: AuthenticatedRequest, @Param("sessionId", new ParseUUIDPipe()) sessionId: string) {
    return this.sessions.get(request.principal!.id, sessionId, request.apiSession?.id);
  }

  @Delete(":sessionId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke one API session owned by the signed-in user" })
  revoke(@Req() request: AuthenticatedRequest, @Param("sessionId", new ParseUUIDPipe()) sessionId: string) {
    const principal = request.principal!;
    return this.sessions.revoke(principal.id, principal.id, sessionId, auditRequest(request));
  }

  @Post("revoke-others")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: RevokeOtherSessionsDto })
  @ApiOperation({ summary: "Revoke all of the signed-in user's other API sessions" })
  revokeOthers(@Req() request: AuthenticatedRequest, @Body() body: RevokeOtherSessionsDto) {
    void body;
    const principal = request.principal!;
    return this.sessions.revokeOthers(principal.id, principal.id, request.apiSession?.id, auditRequest(request));
  }
}
