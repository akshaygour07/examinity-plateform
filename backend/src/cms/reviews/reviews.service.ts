import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { ApproveReviewDto, RequestChangesDto } from "./reviews.dto";
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async queue() {
    return {
      data: await this.prisma.cmsWorkflowTask.findMany({
        where: { taskType: "REVIEW", status: "OPEN" },
        include: { workflow: { include: { revision: true } } },
      }),
    };
  }
  async get(taskId: string) {
    const task = await this.prisma.cmsWorkflowTask.findUnique({
      where: { id: taskId },
      include: { workflow: { include: { revision: true } }, reviews: true },
    });
    if (!task || task.taskType !== "REVIEW")
      throw new NotFoundException({ code: "review_task_not_found", message: "Review task was not found." });
    return { data: task };
  }
  async decide(
    actor: InternalPrincipal,
    taskId: string,
    decision: "APPROVED" | "CHANGES_REQUESTED",
    dto: ApproveReviewDto | RequestChangesDto,
  ) {
    const task = await this.get(taskId);
    if (task.data.status !== "OPEN")
      throw new ConflictException({ code: "review_task_closed", message: "Review task is already complete." });
    if (task.data.assignedToUserId && task.data.assignedToUserId !== actor.id)
      throw new ConflictException({ code: "review_task_assigned_to_other", message: "Task is assigned to another reviewer." });
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.cmsContentReview.create({
        data: {
          workflowTaskId: taskId,
          decision,
          comments: dto.comments,
          fieldComments: (dto.fieldComments ?? []) as Prisma.InputJsonValue,
          decidedByUserId: actor.id,
        },
      });
      await tx.cmsWorkflowTask.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.cmsContentRevision.update({
        where: { id: task.data.workflow.revisionId },
        data: { status: decision === "APPROVED" ? "REVIEWED" : "CHANGES_REQUESTED" },
      });
      await tx.cmsWorkflowInstance.update({
        where: { id: task.data.workflowInstanceId },
        data: { state: decision === "APPROVED" ? "REVIEWED" : "CHANGES_REQUESTED" },
      });
      if (decision === "APPROVED")
        await tx.cmsWorkflowTask.create({
          data: { workflowInstanceId: task.data.workflowInstanceId, taskType: "VERIFICATION", status: "OPEN" },
        });
      return { data: review };
    });
  }
}
