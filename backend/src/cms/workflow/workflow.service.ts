import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { AssignTaskDto } from "./workflow.dto";
@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}
  async submit(actor: InternalPrincipal, revisionId: string) {
    const revision = await this.prisma.cmsContentRevision.findUnique({ where: { id: revisionId } });
    if (!revision) throw new NotFoundException({ code: "revision_not_found", message: "Revision was not found." });
    if (!["DRAFT", "CHANGES_REQUESTED"].includes(revision.status))
      throw new ConflictException({ code: "revision_not_submittable", message: "Only editable revisions may be submitted." });
    return this.prisma.$transaction(async (tx) => {
      await tx.cmsContentRevision.update({ where: { id: revisionId }, data: { status: "IN_REVIEW", submittedAt: new Date() } });
      const workflow = await tx.cmsWorkflowInstance.create({ data: { revisionId, state: "REVIEW", submittedByUserId: actor.id } });
      const task = await tx.cmsWorkflowTask.create({ data: { workflowInstanceId: workflow.id, taskType: "REVIEW", status: "OPEN" } });
      return { data: { workflowId: workflow.id, taskId: task.id, state: workflow.state, submittedAt: workflow.submittedAt } };
    });
  }
  async list(actor: InternalPrincipal) {
    return {
      data: await this.prisma.cmsWorkflowTask.findMany({
        where: { OR: [{ assignedToUserId: actor.id }, { assignedToUserId: null }] },
        include: { workflow: { include: { revision: true } } },
        orderBy: { createdAt: "asc" },
      }),
    };
  }
  async get(id: string) {
    const task = await this.prisma.cmsWorkflowTask.findUnique({
      where: { id },
      include: { workflow: { include: { revision: true } }, reviews: true },
    });
    if (!task) throw new NotFoundException({ code: "workflow_task_not_found", message: "Workflow task was not found." });
    return { data: task };
  }
  async assign(actor: InternalPrincipal, id: string, dto: AssignTaskDto) {
    await this.get(id);
    const task = await this.prisma.cmsWorkflowTask.update({
      where: { id },
      data: { assignedToUserId: dto.userId, assignedByUserId: actor.id },
    });
    return { data: task };
  }
}
