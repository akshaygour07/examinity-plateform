import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Auth0Guard } from "../auth/auth0.guard";
import { AuthorizationGuard } from "../auth/authorization.guard";
import { RequirePermissions } from "../auth/authorization";
import { AuditService } from "./audit.service";
import { AuditQueryDto } from "./audit-query.dto";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@RequirePermissions("admin.audit.view")
@Controller()
/** Read-only, permission-protected endpoints for immutable audit evidence. */
export class AuditController {
  constructor(private readonly audit: AuditService) {}
  @Get(["audit-logs", "admin/audit-logs"])
  @ApiOperation({ summary: "Search immutable administrative and security audit events" })
  @ApiQuery({ name: "actor_user_id", required: false, format: "uuid" })
  @ApiQuery({ name: "target_user_id", required: false, format: "uuid" })
  @ApiQuery({ name: "action", required: false })
  @ApiQuery({ name: "resource_type", required: false })
  @ApiQuery({ name: "resource_id", required: false, format: "uuid" })
  @ApiQuery({ name: "result", required: false, enum: ["SUCCESS", "FAILURE"] })
  @ApiQuery({ name: "from", required: false, format: "date-time" })
  @ApiQuery({ name: "to", required: false, format: "date-time" })
  /** Searches audit events using supported filters and bounded pagination. */
  list(@Query() query: AuditQueryDto) {
    return this.audit.search(query);
  }
  @Get(["audit-logs/:id", "admin/audit-logs/:id"])
  @ApiOperation({ summary: "Get one immutable audit event" })
  /** Reads one audit event by UUID. */
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.audit.get(id);
  }
}
