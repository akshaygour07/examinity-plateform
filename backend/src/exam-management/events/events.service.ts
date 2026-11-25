import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditService, type AuditInput } from "../../audit/audit.service";
import { PrismaService } from "../../database/prisma.service";
import { CancelEventDto, EventDto, EventRevisionDto } from "./dto/event.dto";
@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}
  async list(cycleId: string, publicOnly = false) {
    return {
      data: await this.prisma.examEvent.findMany({
        where: { examCycleId: cycleId, ...(publicOnly ? { eventStatus: "ACTIVE", publishedAt: { not: null } } : {}) },
        include: publicOnly ? undefined : { revisions: { orderBy: { revisionNumber: "asc" } } },
        orderBy: { startAt: "asc" },
      }),
    };
  }
  async create(cycleId: string, d: EventDto) {
    this.dates(d.startAt, d.endAt);
    if (!(await this.prisma.examCycle.findUnique({ where: { id: cycleId } })))
      throw new NotFoundException({ code: "exam_cycle_not_found", message: "The examination cycle was not found." });
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
          eventStatus: d.eventStatus ?? "DRAFT",
        },
      }),
    };
  }
  async update(id: string, d: Partial<EventDto>) {
    const current = await this.prisma.examEvent.findUnique({ where: { id } });
    if (!current) throw new NotFoundException({ code: "exam_event_not_found", message: "The examination event was not found." });
    if (current.publishedAt)
      throw new ConflictException({
        code: "published_event_immutable",
        message: "Published event content must be changed through a reviewed revision.",
      });
    this.dates(d.startAt, d.endAt);
    const item = await this.prisma.examEvent
      .update({
        where: { id },
        data: {
          ...(d.eventType !== undefined ? { eventType: d.eventType } : {}),
          ...(d.title !== undefined ? { title: d.title } : {}),
          ...(d.description !== undefined ? { description: d.description } : {}),
          ...(d.startAt !== undefined ? { startAt: d.startAt ? new Date(d.startAt) : null } : {}),
          ...(d.endAt !== undefined ? { endAt: d.endAt ? new Date(d.endAt) : null } : {}),
          ...(d.displayTimezone !== undefined ? { displayTimezone: d.displayTimezone } : {}),
          ...(d.sourceReferenceId !== undefined ? { sourceReferenceId: d.sourceReferenceId } : {}),
          ...(d.eventStatus !== undefined ? { eventStatus: d.eventStatus } : {}),
        },
      })
      .catch(() => null);
    if (!item) throw new NotFoundException();
    return { data: item };
  }
  async revise(id: string, d: EventRevisionDto) {
    const current = await this.prisma.examEvent.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (!current.publishedAt)
      throw new ConflictException({ code: "event_not_published", message: "Only published events can be revised." });
    if (!d.revisionReason.trim() || !d.sourceReferenceId)
      throw new BadRequestException({
        code: "event_revision_evidence_required",
        message: "A revision reason and official source reference are required.",
      });
    this.dates(d.startAt, d.endAt);
    const revision = await this.prisma.$transaction(async (tx) => {
      const n = (await tx.examEventRevision.count({ where: { examEventId: id } })) + 1;
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
          revisionStatus: "PENDING_REVIEW",
        },
      });
    });
    return { data: revision };
  }
  async cancel(id: string, d: CancelEventDto) {
    const current = await this.prisma.examEvent.findUnique({ where: { id } });
    if (!current) throw new NotFoundException({ code: "exam_event_not_found", message: "The examination event was not found." });
    if (!d.reason.trim())
      throw new BadRequestException({ code: "event_cancellation_reason_required", message: "A cancellation reason is required." });
    if (current.publishedAt && !d.sourceReferenceId)
      throw new BadRequestException({
        code: "event_cancellation_source_required",
        message: "An official source reference is required to cancel a published event.",
      });
    const item = await this.prisma.$transaction(async (tx) => {
      if (current.publishedAt) {
        const revisionNumber = (await tx.examEventRevision.count({ where: { examEventId: id } })) + 1;
        return tx.examEventRevision.create({
          data: {
            examEventId: id,
            revisionNumber,
            previousStartAt: current.startAt,
            newStartAt: current.startAt,
            previousEndAt: current.endAt,
            newEndAt: current.endAt,
            revisionReason: d.reason,
            sourceReferenceId: d.sourceReferenceId,
            revisionStatus: "PENDING_REVIEW",
            requestedEventStatus: "CANCELLED",
          },
        });
      }
      return tx.examEvent.update({ where: { id }, data: { eventStatus: "CANCELLED", description: d.reason } });
    });
    return { data: item };
  }

  async transitionRevision(
    id: string,
    action: "approve" | "verify" | "publish",
    actorUserId: string,
    request: Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress">,
  ) {
    const revision = await this.prisma.examEventRevision.findUnique({ where: { id }, include: { event: true } });
    if (!revision) throw new NotFoundException({ code: "event_revision_not_found", message: "The event revision was not found." });
    const expected = action === "approve" ? "PENDING_REVIEW" : action === "verify" ? "REVIEW_APPROVED" : "VERIFIED";
    const next = action === "approve" ? "REVIEW_APPROVED" : action === "verify" ? "VERIFIED" : "PUBLISHED";
    if (revision.revisionStatus !== expected)
      throw new ConflictException({
        code: "invalid_event_revision_transition",
        message: `The revision must be ${expected} before it can be ${action}d.`,
      });
    if (action === "verify" && !revision.sourceReferenceId)
      throw new ConflictException({
        code: "event_revision_source_required",
        message: "An official source is required before verification.",
      });
    return this.prisma.$transaction(async (tx) => {
      if (action === "publish") {
        const newerRevisions = await tx.examEventRevision.count({
          where: { examEventId: revision.examEventId, revisionNumber: { gt: revision.revisionNumber } },
        });
        if (newerRevisions > 0)
          throw new ConflictException({
            code: "event_revision_superseded",
            message: "A newer event revision exists; publish the latest revision instead.",
          });
      }
      const changed = await tx.examEventRevision.updateMany({ where: { id, revisionStatus: expected }, data: { revisionStatus: next } });
      if (changed.count !== 1)
        throw new ConflictException({
          code: "event_revision_state_changed",
          message: "The revision state changed. Reload it before retrying.",
        });
      let result;
      if (action === "publish") {
        result = await tx.examEvent.update({
          where: { id: revision.examEventId },
          data: {
            startAt: revision.newStartAt,
            endAt: revision.newEndAt,
            eventStatus: revision.requestedEventStatus ?? "ACTIVE",
            publishedAt: new Date(),
          },
        });
      } else {
        result = await tx.examEventRevision.findUniqueOrThrow({ where: { id } });
      }
      await this.audit?.record(
        {
          actorUserId,
          action: `EXAM_EVENT_REVISION_${next}`,
          resourceType: "exam_event_revision",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: { event_id: revision.examEventId, previous_status: expected, new_status: next },
        },
        tx,
      );
      return { data: result };
    });
  }
  private dates(start?: string, end?: string) {
    if (start && end && new Date(end) < new Date(start))
      throw new BadRequestException({ code: "invalid_event_dates", message: "endAt must not precede startAt." });
  }
}
