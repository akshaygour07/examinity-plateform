import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { PublishingService } from "./publishing.service";
import { PublishDto, ScheduleDto } from "./publishing.dto";
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms/revisions")
export class PublishingController {
  constructor(private readonly s: PublishingService) {}
  @Post(":revisionId/publish") @RequirePermissions("cms.publish") publish(
    @Req() r: AuthenticatedRequest,
    @Param("revisionId", ParseUUIDPipe) id: string,
    @Body() _d: PublishDto,
  ) {
    return this.s.publish(r.principal!, id);
  }
  @Post(":revisionId/schedule") @RequirePermissions("cms.publish.schedule") schedule(
    @Req() r: AuthenticatedRequest,
    @Param("revisionId", ParseUUIDPipe) id: string,
    @Body() d: ScheduleDto,
  ) {
    return this.s.schedule(r.principal!, id, d);
  }
}
