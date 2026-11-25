import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AnalysisDto } from "./dto/analysis.dto";
@Injectable()
export class AnalysisService {
  constructor(private readonly prisma: PrismaService) {}
  list(id: string, publicOnly = false) {
    return {
      data: this.prisma.examAnalysisRecord.findMany({
        where: { examCycleId: id, ...(publicOnly ? { publicationStatus: "PUBLISHED" } : {}) },
      }),
    };
  }
  create(id: string, d: AnalysisDto) {
    return {
      data: this.prisma.examAnalysisRecord.create({
        data: {
          examCycleId: id,
          ...d,
          data: d.data as never,
          verificationStatus: d.verificationStatus ?? "UNVERIFIED",
          publicationStatus: d.publicationStatus ?? "DRAFT",
        },
      }),
    };
  }
}
