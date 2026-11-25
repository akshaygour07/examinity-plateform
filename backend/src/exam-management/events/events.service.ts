import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CancelEventDto, EventDto, EventRevisionDto } from "./dto/event.dto";
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(cycleId: string, publicOnly = false) {
    return {
      data: await this.prisma.examEvent.findMany({
        where: { examCycleId: cycleId, ...(publicOnly ? { eventStatus: "ACTIVE" } : {}) },
        orderBy: { startAt: "asc" },
      }),
    };
  }
  async create(cycleId: string, d: EventDto) {
    this.dates(d.startAt, d.endAt);
    return {
      data: await this.prisma.examEvent.create({
        data: {
          examCycleId: cycleId,
          eventType: d.eventType,
          title: d.title,
          description: d.description,
          startAt: d.startAt ? new Date(d.startAt) : null,
          endAt: d.endAt ? new Date(d.endAt) : null,
          displayTimezone: d.displayTimezone ?? "Asia/Kolkata",
          sourceReferenceId: d.sourceReferenceId,
          eventStatus: d.eventStatus ?? "ACTIVE",
        },
      }),
    };
  }
  async update(id: string, d: Partial<EventDto>) {
    this.dates(d.startAt, d.endAt);
    const item = await this.prisma.examEvent
      .update({
        where: { id },
        data: { ...d, startAt: d.startAt ? new Date(d.startAt) : undefined, endAt: d.endAt ? new Date(d.endAt) : undefined },
      })
      .catch(() => null);
    if (!item) throw new NotFoundException();
    return { data: item };
  }
  async revise(id: string, d: EventRevisionDto) {
    const current = await this.prisma.examEvent.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    this.dates(d.startAt, d.endAt);
    const revision = await this.prisma.$transaction(async (tx) => {
      const n = (await tx.examEventRevision.count({ where: { examEventId: id } })) + 1;
      await tx.examEvent.update({
        where: { id },
        data: { startAt: d.startAt ? new Date(d.startAt) : current.startAt, endAt: d.endAt ? new Date(d.endAt) : current.endAt },
      });
      return tx.examEventRevision.create({
        data: {
          examEventId: id,
          revisionNumber: n,
          previousStartAt: current.startAt,
          previousEndAt: current.endAt,
          newStartAt: d.startAt ? new Date(d.startAt) : current.startAt,
          newEndAt: d.endAt ? new Date(d.endAt) : current.endAt,
          revisionReason: d.revisionReason,
          sourceReferenceId: d.sourceReferenceId,
        },
      });
    });
    return { data: revision };
  }
  async cancel(id: string, d: CancelEventDto) {
    const item = await this.prisma.examEvent
      .update({ where: { id }, data: { eventStatus: "CANCELLED", description: { set: d.reason } } })
      .catch(() => null);
    if (!item) throw new NotFoundException();
    return { data: item };
  }
  private dates(start?: string, end?: string) {
    if (start && end && new Date(end) < new Date(start))
      throw new BadRequestException({ code: "invalid_event_dates", message: "endAt must not precede startAt." });
  }
}
