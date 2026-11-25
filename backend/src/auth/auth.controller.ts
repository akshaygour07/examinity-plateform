import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "./auth0.guard";
import { Auth0Guard } from "./auth0.guard";
import { AuthService } from "./auth.service";
import { auditRequest } from "../common/request-context";
import { AuthSyncDto } from "./auth-sync.dto";
import { SessionsService } from "../sessions/sessions.service";

@ApiTags("authentication and identity")
@ApiBearerAuth()
@UseGuards(Auth0Guard)
@Controller("auth")
/** Auth0 access-token-backed identity routes; browser login and session handling belong to the frontend. */
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Get("me")
  @ApiOperation({
    summary: "Resolve the authenticated identity to an active Examinity user and effective roles",
    description:
      "No request body. Click Authorize and provide an Auth0 API access token; the user identity comes from its verified claims.",
  })
  @ApiResponse({ status: 403, description: "Identity is not provisioned or its application account is inactive." })
  /** Resolves the verified token subject to its active local application identity. */
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.currentUser(request.auth0);
  }

  @Post("sync")
  @ApiOperation({
    summary: "Create or refresh the current user's local application profile from Auth0 claims",
    description:
      "Provide an Auth0 API access token. First provisioning requires terms_accepted, the current terms_version, and registration_source (EMAIL, PHONE, or SOCIAL). Unverified identities are stored as PENDING with no roles.",
  })
  @ApiBody({
    type: AuthSyncDto,
    required: false,
    examples: { acceptTerms: { value: { terms_accepted: true, terms_version: "v1", registration_source: "EMAIL" } } },
  })
  @HttpCode(HttpStatus.OK)
  /** Creates or refreshes the local profile and records explicit terms acceptance during first provisioning. */
  sync(@Req() request: AuthenticatedRequest, @Body() body: AuthSyncDto) {
    return this.auth.sync(request.auth0, auditRequest(request), body);
  }

  @Post("logout")
  @ApiOperation({
    summary: "Revoke the current Examinity API token session and record logout",
    description:
      "Revokes this API token for future requests. The client must also clear its browser/BFF session and perform any required Auth0 logout.",
  })
  /** Revokes the observed API token; browser and Auth0 SSO logout remain client responsibilities. */
  logout(@Req() request: AuthenticatedRequest) {
    return this.sessions
      .revokeCurrent(request.apiSession?.id, request.apiSession?.userId, auditRequest(request))
      .then(() => this.auth.recordLogout(request.auth0, auditRequest(request)));
  }
}
