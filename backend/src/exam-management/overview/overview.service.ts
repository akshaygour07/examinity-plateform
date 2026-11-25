import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { PutOverviewDraftDto } from "./dto/put-overview-draft.dto";

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async adminOverview(cycleId: string) {
    await this.ensureCycle(cycleId);
    return {
      data: await this.prisma.examOverviewVersion.findMany({ where: { examCycleId: cycleId }, orderBy: { versionNumber: "desc" } }),
    };
  }

  async saveDraft(cycleId: string, dto: PutOverviewDraftDto) {
    await this.ensureCycle(cycleId);
    const draft = await this.prisma.examOverviewVersion.findFirst({
      where: { examCycleId: cycleId, publicationStatus: "DRAFT" },
      orderBy: { versionNumber: "desc" },
    });
    const data = {
      description: dto.description,
      qualificationSummary: dto.qualificationSummary,
      ageSummary: dto.ageSummary,
      vacancySummary: dto.vacancySummary,
      modeSummary: dto.modeSummary,
      notificationSummary: dto.notificationSummary,
      sourceReferenceId: dto.sourceReferenceId,
    };
    const item = draft
      ? await this.prisma.examOverviewVersion.update({ where: { id: draft.id }, data })
      : await this.prisma.examOverviewVersion.create({
          data: {
            examCycleId: cycleId,
            versionNumber: (await this.prisma.examOverviewVersion.count({ where: { examCycleId: cycleId } })) + 1,
            ...data,
          },
        });
    return { data: item };
  }

  async publicOverview(cycleId: string) {
    const item = await this.prisma.examOverviewVersion.findFirst({
      where: { examCycleId: cycleId, publicationStatus: "PUBLISHED" },
      orderBy: { versionNumber: "desc" },
    });
    if (!item)
      throw new NotFoundException({
        code: "exam_overview_not_found",
        message: "No published overview was found for this examination cycle.",
      });
    return { data: item };
  }

  private async ensureCycle(id: string) {
    if (!(await this.prisma.examCycle.findUnique({ where: { id } })))
      throw new NotFoundException({ code: "exam_cycle_not_found", message: "The examination cycle was not found." });
  }
}
