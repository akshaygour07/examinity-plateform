import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { ApprovalDto } from "./approvals.dto";
@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}
  async queue() {
    return { data: await this.prisma.cmsWorkflowTask.findMany({ where: { taskType: "APPROVAL", status: "OPEN" } }) };
  }
  async get(id: string) {
    const t = await this.prisma.cmsWorkflowTask.findUnique({ where: { id }, include: { workflow: { include: { revision: true } } } });
    if (!t || t.taskType !== "APPROVAL")
      throw new NotFoundException({ code: "approval_task_not_found", message: "Approval task was not found." });
    return { data: t };
  }
  async decide(a: InternalPrincipal, id: string, ok: boolean, d: ApprovalDto) {
    const t = await this.get(id);
    if (t.data.status !== "OPEN") throw new ConflictException({ code: "approval_task_closed", message: "Task is closed." });
    if (ok && t.data.workflow.revision.status !== "VERIFIED")
      throw new ConflictException({ code: "revision_not_verified", message: "Only verified revisions can be approved." });
    return this.prisma.$transaction(async (tx) => {
      const x = await tx.cmsContentApproval.create({
        data: { workflowTaskId: id, decision: ok ? "APPROVED" : "CHANGES_REQUESTED", comments: d.comments, approverUserId: a.id },
      });
      await tx.cmsWorkflowTask.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.cmsContentRevision.update({
        where: { id: t.data.workflow.revisionId },
        data: { status: ok ? "APPROVED" : "CHANGES_REQUESTED" },
      });
      return { data: x };
    });
  }
}
