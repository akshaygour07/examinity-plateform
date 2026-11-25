import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { SalaryDto } from "./dto/salary.dto";
@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService) {}
  list(id: string) {
    return { data: this.prisma.salaryRecord.findMany({ where: { examCycleId: id } }) };
  }
  create(id: string, d: SalaryDto) {
    return {
      data: this.prisma.salaryRecord.create({
        data: {
          examCycleId: id,
          postName: d.postName,
          payLevel: d.payLevel,
          basicPayMin: d.basicPayMin,
          basicPayMax: d.basicPayMax,
          payScale: d.payScale,
          allowances: d.allowances as never,
          benefits: d.benefits,
          effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom) : null,
          effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null,
        },
      }),
    };
  }
}
