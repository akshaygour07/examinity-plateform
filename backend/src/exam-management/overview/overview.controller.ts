import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { Auth0Guard } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { PutOverviewDraftDto } from "./dto/put-overview-draft.dto";
import { OverviewService } from "./overview.service";
@Controller()
export class OverviewController {
  constructor(private readonly service: OverviewService) {}
  @Get("public/exam-cycles/:cycleId/overview") publicOverview(@Param("cycleId") id: string) {
    return this.service.publicOverview(id);
  }
  @UseGuards(Auth0Guard, AuthorizationGuard)
  @ApiBearerAuth()
  @Get("admin/exam-cycles/:cycleId/overview")
  @RequirePermissions("exam.catalogue.read")
  adminOverview(@Param("cycleId") id: string) {
    return this.service.adminOverview(id);
  }
  @Put("admin/exam-cycles/:cycleId/overview/draft") @RequirePermissions("exam.catalogue.update") saveDraft(
    @Param("cycleId") id: string,
    @Body() dto: PutOverviewDraftDto,
  ) {
    return this.service.saveDraft(id, dto);
  }
}
