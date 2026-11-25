import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class ExamPatternService {
  constructor(private readonly prisma: PrismaService) {}
  async cyclePattern(cycleId: string, publicOnly = false) {
    const item = await this.prisma.examPatternVersion.findFirst({
      where: { examCycleId: cycleId, ...(publicOnly ? { publicationStatus: "PUBLISHED" } : {}) },
      include: {
        stages: { include: { papers: { include: { markingScheme: true }, orderBy: { sequence: "asc" } } }, orderBy: { sequence: "asc" } },
      },
      orderBy: { versionNumber: "desc" },
    });
    if (!item) throw new NotFoundException({ code: "exam_pattern_not_found", message: "No examination pattern was found for this cycle." });
    return { data: item };
  }
  async version(id: string) {
    const item = await this.prisma.examPatternVersion.findUnique({
      where: { id },
      include: { stages: { include: { papers: true }, orderBy: { sequence: "asc" } } },
    });
    if (!item) throw new NotFoundException({ code: "exam_pattern_not_found", message: "The examination pattern was not found." });
    return { data: item };
  }
}
