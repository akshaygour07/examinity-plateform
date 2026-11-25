import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class SelectionProcessRepository {
  constructor(readonly prisma: PrismaService) {}
}
