import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { ScheduleDto } from "./publishing.dto";
@Injectable()
export class PublishingService {
  constructor(private readonly prisma: PrismaService) {}
  async revision(id: string) {
    const r = await this.prisma.cmsContentRevision.findUnique({ where: { id } });
    if (!r) throw new NotFoundException({ code: "revision_not_found", message: "Revision was not found." });
    if (r.status !== "APPROVED") throw new ConflictException({ code: "revision_not_approved", message: "Revision must be approved." });
    return r;
  }
  async publish(a: InternalPrincipal, id: string) {
    const r = await this.revision(id);
    const existing = await this.prisma.cmsPublication.findFirst({ where: { contentRevisionId: id, publicationStatus: "PUBLISHED" } });
    if (existing) return { data: existing };
    const p = await this.prisma.$transaction(async (tx) => {
      const x = await tx.cmsPublication.create({
        data: {
          contentItemId: r.contentItemId,
          contentRevisionId: id,
          locale: r.locale,
          publishedByUserId: a.id,
          publicationStatus: "PUBLISHED",
        },
      });
      await tx.cmsContentRevision.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.cmsContentItem.update({ where: { id: r.contentItemId }, data: { publishedRevisionId: id, status: "PUBLISHED" } });
      return x;
    });
    return { data: p };
  }
  async schedule(a: InternalPrincipal, id: string, d: ScheduleDto) {
    const r = await this.revision(id);
    const at = new Date(d.scheduledAt);
    if (at <= new Date()) throw new ConflictException({ code: "schedule_must_be_future", message: "scheduledAt must be in the future." });
    const x = await this.prisma.cmsScheduledPublication.create({
      data: {
        contentItemId: r.contentItemId,
        contentRevisionId: id,
        scheduledAt: at,
        timeZone: d.timeZone,
        status: "PENDING",
        createdByUserId: a.id,
      },
    });
    return { data: x };
  }
}
