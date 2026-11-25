import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Auth0Guard, type AuthenticatedRequest } from "../../auth/auth0.guard";
import { AuthorizationGuard } from "../../auth/authorization.guard";
import { RequirePermissions } from "../../auth/authorization";
import { WorkflowService } from "./workflow.service";
import { AssignTaskDto, SubmitContentDto } from "./workflow.dto";
@ApiTags("cms workflow")
@ApiBearerAuth()
@UseGuards(Auth0Guard, AuthorizationGuard)
@Controller("admin/cms")
export class CmsWorkflowController {
  constructor(private readonly workflow: WorkflowService) {}
  @Post("revisions/:revisionId/submit") @RequirePermissions("cms.content.submit") submit(
    @Req() r: AuthenticatedRequest,
    @Param("revisionId", ParseUUIDPipe) id: string,
    @Body() d: SubmitContentDto,
  ) {
    void d;
    return this.workflow.submit(r.principal!, id);
  }
  @Get("workflow/tasks") @RequirePermissions("cms.workflow.read") list(@Req() r: AuthenticatedRequest) {
    return this.workflow.list(r.principal!);
  }
  @Get("workflow/tasks/:taskId") @RequirePermissions("cms.workflow.read") get(@Param("taskId", ParseUUIDPipe) id: string) {
    return this.workflow.get(id);
  }
  @Post("workflow/tasks/:taskId/assign") @RequirePermissions("cms.assignment.manage") assign(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: AssignTaskDto,
  ) {
    return this.workflow.assign(r.principal!, id, d);
  }
  @Post("workflow/tasks/:taskId/reassign") @RequirePermissions("cms.assignment.manage") reassign(
    @Req() r: AuthenticatedRequest,
    @Param("taskId", ParseUUIDPipe) id: string,
    @Body() d: AssignTaskDto,
  ) {
    return this.workflow.assign(r.principal!, id, d);
  }
}
