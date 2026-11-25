import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { effectivePagination } from "../common/effective-pagination";

export type AuditInput = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId: string;
  correlationId?: string | null;
  result: "SUCCESS" | "FAILURE";
  metadata?: Prisma.InputJsonValue;
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
/** Writes append-only audit events and provides paginated audit queries. */
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists an audit event, optionally in the caller's transaction so evidence commits with the change. */
  record(input: AuditInput, tx?: Prisma.TransactionClient) {
    const writer = tx ?? this.prisma;
    return writer.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        requestId: input.requestId,
        correlationId: input.correlationId ?? null,
        result: input.result,
        metadataJson: input.metadata,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  /** Searches audit events using the supplied filters and bounded pagination. */
  async search(query: {
    page: number;
    page_size?: number;
    action?: string;
    resource_type?: string;
    resource_id?: string;
    actor_user_id?: string;
    target_user_id?: string;
    result?: string;
    from?: string;
    to?: string;
  }) {
    const pagination = await effectivePagination(this.prisma, query);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.resource_type ? { resourceType: query.resource_type } : {}),
      ...(query.resource_id ? { resourceId: query.resource_id } : {}),
      ...(query.actor_user_id ? { actorUserId: query.actor_user_id } : {}),
      ...(query.target_user_id ? { metadataJson: { path: ["target_user_id"], equals: query.target_user_id } } : {}),
      ...(query.result ? { result: query.result } : {}),
      ...(query.from || query.to
        ? { occurredAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (pagination.page - 1) * pagination.page_size,
        take: pagination.page_size,
      }),
    ]);
    return { data: items, pagination: { ...pagination, total } };
  }

  /** Returns one audit event by ID or raises not-found when it does not exist. */
  async get(id: string) {
    const item = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!item) throw new NotFoundException({ code: "audit_event_not_found", message: "The audit event was not found." });
    return { data: item };
  }
}
