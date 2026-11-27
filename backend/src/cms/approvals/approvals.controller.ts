import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { ApprovalsService } from "./approvals.service";
import { ApprovalDto } from "./approvals.dto";
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms/approvals")
export class ApprovalsController {
  constructor(private readonly s: ApprovalsService) {}
  @Get("queue") @RequirePermissions("cms.approval.read") queue() {
    return this.s.queue();
  }
  @Get(":taskId") @RequirePermissions("cms.approval.read") get(@Param("taskId", ParseUUIDPipe) id: string) {
    return this.s.get(id);
  }
  @Post(":taskId/approve") @RequirePermissions("cms.approval.manage") approve(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: ApprovalDto,
  ) {
    return this.s.decide(r.principal!, id, true, d);
  }
  @Post(":taskId/request-changes") @RequirePermissions("cms.approval.manage") changes(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: ApprovalDto,
  ) {
    return this.s.decide(r.principal!, id, false, d);
  }
}
