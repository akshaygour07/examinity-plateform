import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { ReviewsService } from "./reviews.service";
import { ApproveReviewDto, RequestChangesDto } from "./reviews.dto";
@ApiTags("cms reviews")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms/reviews")
export class CmsReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get("queue") @RequirePermissions("cms.review.read") queue() {
    return this.reviews.queue();
  }
  @Get(":taskId") @RequirePermissions("cms.review.read") get(@Param("taskId", ParseUUIDPipe) id: string) {
    return this.reviews.get(id);
  }
  @Post(":taskId/approve") @RequirePermissions("cms.review.manage") approve(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: ApproveReviewDto,
  ) {
    return this.reviews.decide(r.principal!, id, "APPROVED", d);
  }
  @Post(":taskId/request-changes") @RequirePermissions("cms.review.manage") changes(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: RequestChangesDto,
  ) {
    return this.reviews.decide(r.principal!, id, "CHANGES_REQUESTED", d);
  }
}
