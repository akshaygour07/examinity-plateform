import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";
import type { AuthenticatedRequest } from "../auth/auth0.guard";
import { auditRequest } from "../common/request-context";
import { RolesService } from "./roles.service";
import { UpdateRolePermissionsDto } from "./update-role-permissions.dto";
import { PageQueryDto } from "../common/page-query.dto";

@ApiTags("roles and permissions")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller()
/** Permission-protected routes for role definitions and role-permission mappings (D9). */
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get(["roles", "admin/roles"])
  @RequirePermissions("admin.roles.view")
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "page_size", required: false, maximum: 100 })
  @ApiOperation({ summary: "List active application roles" })
  /** Lists active roles available to administrative clients. */
  list(@Query() query: PageQueryDto) {
    return this.roles.list(query);
  }

  @Get(["roles/:id", "admin/roles/:id"])
  @RequirePermissions("admin.roles.view")
  @ApiOperation({ summary: "Get an application role and its permissions" })
  /** Reads an active role and its active permissions. */
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.roles.get(id);
  }

  @Get(["permissions", "admin/permissions"])
  @RequirePermissions("admin.permissions.view")
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "page_size", required: false, maximum: 100 })
  @ApiOperation({ summary: "List registered active permission definitions" })
  /** Lists permission codes that may be assigned to custom roles. */
  permissions(@Query() query: PageQueryDto) {
    return this.roles.permissions(query);
  }

  @Get(["roles/:id/permissions", "admin/roles/:id/permissions"])
  @RequirePermissions("admin.roles.view")
  @ApiOperation({ summary: "List permissions assigned to a role" })
  /** Lists active permissions currently mapped to the selected role. */
  rolePermissions(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.roles.rolePermissions(id);
  }

  @Put(["roles/:id/permissions", "admin/roles/:id/permissions"])
  @RequirePermissions("admin.roles.permissions.manage")
  @ApiOperation({ summary: "Replace permissions on a non-system role" })
  @ApiBody({
    type: UpdateRolePermissionsDto,
    examples: {
      replacePermissions: {
        summary: "Replace mappings with permission IDs from GET /api/v1/permissions",
        value: { permission_ids: ["00000000-0000-4000-8000-000000000003", "00000000-0000-4000-8000-000000000004"] },
      },
      removeAllPermissions: { summary: "Remove all permission mappings", value: { permission_ids: [] } },
    },
  })
  /** Replaces a custom role's permission mappings; system role mappings are protected. */
  replacePermissions(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRolePermissionsDto,
  ) {
    return this.roles.replacePermissions(request.principal!, id, body, auditRequest(request));
  }
}
