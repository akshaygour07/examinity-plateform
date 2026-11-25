import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { RevisionsService } from "./revisions.service";
import { CreateRevisionDto } from "./revisions.dto";
@ApiTags("cms revisions")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms")
export class CmsRevisionsController {
  constructor(private readonly revisions: RevisionsService) {}
  @Get("content/:contentId/revisions") @RequirePermissions("cms.revision.read") list(@Param("contentId", ParseUUIDPipe) id: string) {
    return this.revisions.list(id);
  }
  @Get("revisions/:revisionId") @RequirePermissions("cms.revision.read") get(@Param("revisionId", ParseUUIDPipe) id: string) {
    return this.revisions.get(id);
  }
  @Post("content/:contentId/revisions") @RequirePermissions("cms.revision.create") create(
    @Req() r: AuthenticatedRequest,
    @Param("contentId", ParseUUIDPipe) id: string,
    @Body() d: CreateRevisionDto,
  ) {
    return this.revisions.create(r.principal!, id, d);
  }
  @Get("revisions/:revisionId/compare/:otherRevisionId") @RequirePermissions("cms.revision.read") compare(
    @Param("revisionId", ParseUUIDPipe) id: string,
    @Param("otherRevisionId", ParseUUIDPipe) other: string,
  ) {
    return this.revisions.compare(id, other);
  }
}
