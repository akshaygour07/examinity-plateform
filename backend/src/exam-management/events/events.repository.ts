import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
@Injectable()
export class EventsRepository {
  constructor(readonly prisma: PrismaService) {}
}
