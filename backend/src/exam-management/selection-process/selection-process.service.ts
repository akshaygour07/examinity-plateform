import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CreateSelectionProcessDto, SelectionStageDto } from "./dto/selection-process.dto";
@Injectable()
export class SelectionProcessService {
  constructor(private readonly prisma: PrismaService) {}
  async list(cycleId: string, publicOnly = false) {
    const item = await this.prisma.selectionProcessVersion.findFirst({
      where: { examCycleId: cycleId, ...(publicOnly ? { publicationStatus: "PUBLISHED" } : {}) },
      include: { stages: { orderBy: { sequence: "asc" } } },
      orderBy: { versionNumber: "desc" },
    });
    if (!item)
      throw new NotFoundException({ code: "selection_process_not_found", message: "No selection process was found for this cycle." });
    return { data: item };
  }
  async create(cycleId: string, d: CreateSelectionProcessDto) {
    const n = (await this.prisma.selectionProcessVersion.count({ where: { examCycleId: cycleId } })) + 1;
    return {
      data: await this.prisma.selectionProcessVersion.create({
        data: { examCycleId: cycleId, versionNumber: n, publicationStatus: d.publicationStatus ?? "DRAFT" },
      }),
    };
  }
  async addStage(id: string, d: SelectionStageDto) {
    return {
      data: await this.prisma.selectionStage.create({ data: { selectionProcessVersionId: id, ...d, isMandatory: d.isMandatory ?? true } }),
    };
  }
  async updateStage(id: string, d: SelectionStageDto) {
    const item = await this.prisma.selectionStage.update({ where: { id }, data: d }).catch(() => null);
    if (!item) throw new NotFoundException();
    return { data: item };
  }
}
