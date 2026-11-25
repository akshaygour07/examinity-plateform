import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/auth0.guard";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";
import { ListUsersDto } from "./list-users.dto";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./update-user.dto";
import { UpdatePreferencesDto } from "./update-preferences.dto";
import { AssignRoleDto, RevokeRoleDto } from "./assign-role.dto";
import { auditRequest } from "../common/request-context";
import { LockUserDto, UpdateUserStatusDto } from "./update-user-status.dto";
import { ApproveReinstatementDto, RejectReinstatementDto, ReinstateUserDto } from "./reinstate-user.dto";
import { UnlockUserDto } from "./unlock-user.dto";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller()
/**
 * Authenticated user administration and self-service routes.
 *
 * All routes are registered under the global `/api/v1` prefix set in `main.ts`.
 * Routes that appear in both the standard (`users/…`) and admin (`admin/users/…`)
 * namespaces use an array of paths on the method decorator so a single handler
 * satisfies both URL conventions without duplicating logic.
 *
 * Self-service endpoints (preferences, profile update) do NOT carry a
 * `@RequirePermissions()` decorator — they are protected only by `Auth0Guard`
 * and enforce identity ownership inside the service layer.
 */
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(["users", "admin/users"])
  @ApiOperation({ summary: "List application users; requires admin.users.view" })
  @ApiQuery({ name: "status", required: false, enum: ["PENDING", "ACTIVE", "LOCKED", "SUSPENDED", "DISABLED"] })
  @ApiQuery({ name: "user_id", required: false, description: "Exact Examinity user UUID." })
  @ApiQuery({ name: "name", required: false, description: "Case-insensitive first-name or last-name substring." })
  @ApiQuery({ name: "email", required: false, description: "Case-insensitive email substring." })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "page_size", required: false, example: 20, maximum: 100 })
  @ApiQuery({ name: "search", required: false, maxLength: 100 })
  @ApiQuery({ name: "mobile_number", required: false, maxLength: 20 })
  @ApiQuery({ name: "role_code", required: false, maxLength: 100 })
  @ApiQuery({ name: "email_verified", required: false, type: Boolean })
  @ApiQuery({ name: "mobile_verified", required: false, type: Boolean })
  @ApiQuery({ name: "created_from", required: false, type: String })
  @ApiQuery({ name: "created_to", required: false, type: String })
  @RequirePermissions("admin.users.view")
  @ApiResponse({ status: 403, description: "The user lacks the admin.users.view application permission." })
  /** Returns a paginated user summary filtered and ordered by the supplied query parameters. */
  list(@Req() request: AuthenticatedRequest, @Query() query: ListUsersDto) {
    return this.users.list(request.principal!, query);
  }

  @Get(["users/:id", "admin/users/:id"])
  @RequirePermissions("admin.users.view")
  @ApiOperation({ summary: "Get a user and profile by internal Examinity UUID" })
  /** Returns a user's profile and currently effective role codes. */
  get(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.users.get(request.principal!, id);
  }

  @Get("users/:id/preferences")
  @ApiOperation({ summary: "Read own notification preferences; self-service only" })
  /** Reads preferences for the signed-in user; the path ID must match the authenticated principal. */
  preferences(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.users.getPreferences(request.principal!, id);
  }

  @Patch("users/:id/preferences")
  @ApiOperation({ summary: "Update own transactional/marketing email preferences; self-service only and audited" })
  @ApiBody({
    type: UpdatePreferencesDto,
    examples: {
      updatePreferences: {
        value: { transactional_email_enabled: true, marketing_email_enabled: false },
      },
    },
  })
  /** Updates the signed-in user's email preferences and records the change in the audit log. */
  updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.users.updatePreferences(request.principal!, id, body, auditRequest(request));
  }

  @Patch("users/:id")
  @ApiOperation({ summary: "Update approved profile fields for self or an authorized user" })
  @ApiBody({
    type: UpdateUserDto,
    examples: {
      updateProfile: {
        summary: "Update the signed-in user's application profile",
        value: {
          first_name: "Aarav",
          last_name: "Sharma",
          display_name: "Aarav Sharma",
          locale: "en-IN",
          timezone: "Asia/Kolkata",
        },
      },
    },
  })
  /** Updates allowlisted profile fields for self or an actor with `user.update`; identity claims remain Auth0-owned. */
  update(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: UpdateUserDto) {
    return this.users.update(request.principal!, id, body, auditRequest(request));
  }

  @Post("users/:id/disable")
  @RequirePermissions("admin.users.status.update")
  @ApiOperation({ summary: "Disable an Examinity application account" })
  /** Disables an account; the service protects the final active SUPER_ADMIN and audits successful changes. */
  disable(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: UpdateUserStatusDto) {
    if (body.status !== "DISABLED")
      throw new BadRequestException({ code: "invalid_status_action", message: "This route only accepts DISABLED status." });
    return this.users.setStatus(request.principal!, id, body, auditRequest(request));
  }

  @Post("users/:id/enable")
  @RequirePermissions("admin.users.status.update")
  @ApiOperation({ summary: "Enable an Examinity application account" })
  /** Re-enables a disabled account; pending and suspended accounts require a separate workflow. */
  enable(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: UpdateUserStatusDto) {
    if (body.status !== "ACTIVE")
      throw new BadRequestException({ code: "invalid_status_action", message: "This route only accepts ACTIVE status." });
    return this.users.setStatus(request.principal!, id, body, auditRequest(request));
  }

  @Get(["users/:id/roles", "admin/users/:id/roles"])
  @RequirePermissions("admin.roles.view")
  @ApiOperation({ summary: "List a user's role assignments" })
  /** Lists the target user's role assignments; requires admin.roles.view. */
  roles(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.users.listRoles(id);
  }

  @Post(["users/:id/roles", "admin/users/:id/roles"])
  @RequirePermissions("admin.roles.assign")
  @ApiOperation({ summary: "Assign an existing application role" })
  @ApiBody({
    type: AssignRoleDto,
    examples: {
      assignRole: {
        summary: "Assign a role using its ID from GET /api/v1/roles",
        value: { role_id: "00000000-0000-4000-8000-000000000002" },
      },
      timeBoundAssignment: {
        summary: "Assign a role for a date range",
        value: {
          role_id: "00000000-0000-4000-8000-000000000002",
          starts_at: "2026-10-24T09:00:00.000Z",
          ends_at: "2027-10-24T09:00:00.000Z",
        },
      },
    },
  })
  /** Assigns a role, optionally within a time window; changes are audited. */
  assignRole(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: AssignRoleDto) {
    return this.users.assignRole(request.principal!, id, body, auditRequest(request));
  }

  @Delete(["users/:id/roles/:roleId", "admin/users/:id/roles/:roleId"])
  @RequirePermissions("admin.roles.revoke")
  @ApiOperation({ summary: "Remove an application role assignment" })
  /** Removes the specified assignment and records the change in the audit log. */
  removeRole(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("roleId", new ParseUUIDPipe()) roleId: string,
    @Body() body: RevokeRoleDto,
  ) {
    return this.users.removeRole(request.principal!, id, roleId, body, auditRequest(request));
  }
}

@ApiTags("admin users")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/users")
/**
 * Admin-namespace alias for the shared Module 1 account-status endpoint.
 *
 * Permission checks are declared at the method level so that an actor with
 * only `user.disable` or only `user.enable` can still call this endpoint for
 * the state transition they are authorised to perform.  A class-level
 * `@RequirePermissions("user.disable", "user.enable")` would require BOTH
 * permissions simultaneously, which is incorrect.
 */
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Patch(":id/status")
  @RequirePermissions("admin.users.status.update")
  @ApiOperation({
    summary: "Update an application account status (ACTIVE / DISABLED / SUSPENDED)",
    description:
      "Requires `admin.users.status.update`. " +
      "LOCKED accounts must use POST /admin/users/:id/unlock. " +
      "SUSPENDED accounts must use POST /admin/users/:id/reinstate.",
  })
  /**
   * Delegates to the shared `UsersService.setStatus` implementation.
   * The service enforces the last-SUPER_ADMIN safeguard and emits the
   * relevant audit event in the same database transaction.
   */
  updateStatus(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: UpdateUserStatusDto) {
    return this.users.setStatus(request.principal!, id, body, auditRequest(request));
  }

  @Post(":id/lock")
  @RequirePermissions("admin.users.lock")
  @ApiOperation({ summary: "Lock an account through the shared Module 1 lifecycle (D8)" })
  lock(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: LockUserDto) {
    return this.users.lock(request.principal!, id, body, auditRequest(request));
  }

  @Post(":id/reinstate")
  @RequirePermissions("admin.users.reinstate")
  @ApiOperation({
    summary: "Reinstate a SUSPENDED account (D2 — account reinstatement policy)",
    description:
      "Reinstates a SUSPENDED account to ACTIVE. Requires `admin.users.reinstate` permission. " +
      "A mandatory reason must be provided. Self-reinstatement is denied. " +
      "Security/fraud-flagged suspensions require SUPER_ADMIN authority. " +
      "Module 1 session invalidation and reinstatement notification are triggered after commit.",
  })
  @ApiBody({
    type: ReinstateUserDto,
    examples: {
      reinstate: {
        summary: "Reinstate a suspended account with a mandatory reason",
        value: { reason: "Account suspension issue reviewed and resolved. User confirmed identity via support ticket #12345." },
      },
    },
  })
  @ApiResponse({ status: 409, description: "Account is not SUSPENDED or actor is attempting self-reinstatement." })
  @ApiResponse({ status: 403, description: "Actor lacks admin.users.reinstate permission or attempted self-reinstatement." })
  reinstate(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: ReinstateUserDto) {
    return this.users.reinstate(request.principal!, id, body, auditRequest(request));
  }

  @Post(":id/reinstate/approve")
  @RequirePermissions("admin.users.reinstate")
  @ApiOperation({ summary: "Approve a restricted account reinstatement request (SUPER_ADMIN only, D2)" })
  @ApiBody({ type: ApproveReinstatementDto })
  approveReinstatement(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ApproveReinstatementDto,
  ) {
    return this.users.approveReinstatement(request.principal!, id, body, auditRequest(request));
  }

  @Post(":id/reinstate/reject")
  @RequirePermissions("admin.users.reinstate")
  @ApiOperation({ summary: "Reject a restricted account reinstatement request (SUPER_ADMIN only, D2)" })
  @ApiBody({ type: RejectReinstatementDto })
  rejectReinstatement(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: RejectReinstatementDto,
  ) {
    return this.users.rejectReinstatement(request.principal!, id, body, auditRequest(request));
  }

  @Post(":id/unlock")
  @RequirePermissions("admin.users.unlock")
  @ApiOperation({
    summary: "Unlock a LOCKED account (D8 — account lock / unlock policy)",
    description:
      "Unlocks a LOCKED account and restores it to ACTIVE status. Requires `admin.users.unlock` permission. " +
      "Self-unlock is denied. Auth0 brute-force protection is a separate control; if the lock " +
      "originated from Auth0 attack-protection, the Auth0 block must also be cleared via " +
      "DELETE /api/v2/users/:auth0UserId/blocks on the Auth0 Management API. " +
      "Does not restore previously revoked sessions.",
  })
  @ApiBody({
    type: UnlockUserDto,
    examples: {
      unlock: {
        summary: "Unlock a LOCKED account",
        value: { reason: "Verified no ongoing security incident. User completed identity verification via support." },
      },
    },
  })
  @ApiResponse({ status: 409, description: "Account is not LOCKED or actor is attempting self-unlock." })
  @ApiResponse({ status: 403, description: "Actor lacks admin.users.unlock permission or attempted self-unlock." })
  unlock(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() body: UnlockUserDto) {
    return this.users.unlock(request.principal!, id, body, auditRequest(request));
  }
}
