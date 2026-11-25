import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

/** Prisma access boundary for examination-management persistence. */
@Injectable()
export class ExamsRepository {
  constructor(readonly prisma: PrismaService) {}
}
