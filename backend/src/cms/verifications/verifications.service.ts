import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { VerificationChangesDto, VerifyDto } from "./verifications.dto";
@Injectable()
export class VerificationsService {
  constructor(private readonly prisma: PrismaService) {}
  async queue() {
    return { data: await this.prisma.cmsWorkflowTask.findMany({ where: { taskType: "VERIFICATION", status: "OPEN" } }) };
  }
  async get(id: string) {
    const t = await this.prisma.cmsWorkflowTask.findUnique({ where: { id }, include: { workflow: { include: { revision: true } } } });
    if (!t || t.taskType !== "VERIFICATION")
      throw new NotFoundException({ code: "verification_task_not_found", message: "Verification task was not found." });
    return { data: t };
  }
  async decide(a: InternalPrincipal, id: string, ok: boolean, d: VerifyDto | VerificationChangesDto) {
    const t = await this.get(id);
    if (t.data.status !== "OPEN") throw new ConflictException({ code: "verification_task_closed", message: "Task is closed." });
    return this.prisma.$transaction(async (tx) => {
      const v = await tx.cmsContentVerification.create({
        data: {
          workflowTaskId: id,
          decision: ok ? "VERIFIED" : "CHANGES_REQUESTED",
          verificationNotes: ok ? (d as VerifyDto).verificationNotes : (d as VerificationChangesDto).comments,
          sourceIds: (ok ? (d as VerifyDto).sourceIds : []) as Prisma.InputJsonValue,
          verifierUserId: a.id,
        },
      });
      await tx.cmsWorkflowTask.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await tx.cmsContentRevision.update({
        where: { id: t.data.workflow.revisionId },
        data: { status: ok ? "VERIFIED" : "CHANGES_REQUESTED" },
      });
      if (ok)
        await tx.cmsWorkflowTask.create({ data: { workflowInstanceId: t.data.workflowInstanceId, taskType: "APPROVAL", status: "OPEN" } });
      return { data: v };
    });
  }
}
