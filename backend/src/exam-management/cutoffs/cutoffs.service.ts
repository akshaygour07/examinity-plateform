import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CutoffDto } from "./dto/cutoff.dto";
@Injectable()
export class CutoffsService {
  constructor(private readonly prisma: PrismaService) {}
  list(id: string) {
    return { data: this.prisma.cutoffRecord.findMany({ where: { examCycleId: id } }) };
  }
  create(id: string, d: CutoffDto) {
    return { data: this.prisma.cutoffRecord.create({ data: { examCycleId: id, ...d } }) };
  }
}
