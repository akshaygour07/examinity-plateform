import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { VerificationsService } from "./verifications.service";
import { VerificationChangesDto, VerifyDto } from "./verifications.dto";
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms/verifications")
export class VerificationsController {
  constructor(private readonly s: VerificationsService) {}
  @Get("queue") @RequirePermissions("cms.verification.read") queue() {
    return this.s.queue();
  }
  @Get(":taskId") @RequirePermissions("cms.verification.read") get(@Param("taskId", ParseUUIDPipe) id: string) {
    return this.s.get(id);
  }
  @Post(":taskId/verify") @RequirePermissions("cms.verification.manage") verify(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: VerifyDto,
  ) {
    return this.s.decide(r.principal!, id, true, d);
  }
  @Post(":taskId/request-changes") @RequirePermissions("cms.verification.manage") changes(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: VerificationChangesDto,
  ) {
    return this.s.decide(r.principal!, id, false, d);
  }
}
