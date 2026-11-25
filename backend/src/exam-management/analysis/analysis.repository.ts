import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class AnalysisRepository {
  constructor(readonly prisma: PrismaService) {}
}
