import { Module } from "@nestjs/common";
import { CmsWorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";
@Module({ controllers: [CmsWorkflowController], providers: [WorkflowService] })
export class WorkflowModule {}
