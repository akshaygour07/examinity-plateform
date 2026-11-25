import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { ContentService } from "./content.service";
import { ArchiveContentDto, CreateContentDto, ListContentDto, UpdateContentDto } from "./content.dto";
@ApiTags("cms content")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms/content")
export class CmsContentController {
  constructor(private readonly content: ContentService) {}
  @Post() @RequirePermissions("cms.content.create") create(@Req() r: AuthenticatedRequest, @Body() d: CreateContentDto) {
    return this.content.create(r.principal!, d);
  }
  @Get() @RequirePermissions("cms.content.read") list(@Query() q: ListContentDto) {
    return this.content.list(q);
  }
  @Get(":contentId") @RequirePermissions("cms.content.read") get(@Param("contentId", ParseUUIDPipe) id: string) {
    return this.content.get(id);
  }
  @Patch(":contentId") @RequirePermissions("cms.content.update") update(
    @Param("contentId", ParseUUIDPipe) id: string,
    @Body() d: UpdateContentDto,
  ) {
    return this.content.update(id, d);
  }
  @Delete(":contentId") @RequirePermissions("cms.content.delete") remove(@Param("contentId", ParseUUIDPipe) id: string) {
    return this.content.remove(id);
  }
  @Post(":contentId/archive") @RequirePermissions("cms.content.archive") archive(
    @Param("contentId", ParseUUIDPipe) id: string,
    @Body() d: ArchiveContentDto,
  ) {
    void d;
    return this.content.archive(id);
  }
  @Post(":contentId/restore") @RequirePermissions("cms.content.restore") restore(@Param("contentId", ParseUUIDPipe) id: string) {
    return this.content.restore(id);
  }
}
