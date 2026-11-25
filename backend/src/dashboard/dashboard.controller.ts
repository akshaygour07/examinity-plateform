import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/auth0.guard";
import { Auth0Guard } from "../auth/auth0.guard";
import { DashboardService } from "./dashboard.service";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(Auth0Guard)
@Controller()
/** Authenticated landing-page data; this endpoint does not grant access to any other API operation. */
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("dashboard")
  @ApiOperation({
    summary: "Get the authenticated user's Module 1 dashboard summary",
    description:
      "Returns the current user's profile summary, account status, and navigation links derived from effective permissions. Navigation visibility is informational; every API request still performs its own authentication and authorization checks. No exam-specific analytics are included.",
  })
  @ApiResponse({ status: 401, description: "A valid Auth0 API access token is required." })
  @ApiResponse({ status: 403, description: "The identity is not provisioned, active, or verified." })
  /** Returns a small landing-page payload for the identity represented by the verified bearer token. */
  getDashboard(@Req() request: AuthenticatedRequest) {
    return this.dashboard.getForSubject(request.auth0.sub);
  }

  @Get("admin/dashboard")
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @RequirePermissions("admin.dashboard.view")
  @ApiOperation({ summary: "Get an administrator dashboard summary from shared platform records" })
  /** Builds current counts and recent activity from existing identity, RBAC, settings, flags and audit tables. */
  getAdminDashboard() {
    return this.dashboard.getAdminSummary();
  }
}
