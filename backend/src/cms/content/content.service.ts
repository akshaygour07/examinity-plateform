import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { CreateContentDto, ListContentDto, UpdateContentDto } from "./content.dto";
const editable = ["DRAFT", "CHANGES_REQUESTED"];
const validBody = (body: Record<string, unknown>) => body.schemaVersion === 1 && body.type === "doc" && Array.isArray(body.content);
const plainText = (value: unknown): string =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(plainText).join(" ")
      : value && typeof value === "object"
        ? Object.values(value).map(plainText).join(" ")
        : "";
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}
  async findItem(id: string) {
    const item = await this.prisma.cmsContentItem.findFirst({
      where: { id, deletedAt: null },
      include: { contentType: true, revisions: { orderBy: { revisionNumber: "desc" } } },
    });
    if (!item) throw new NotFoundException({ code: "content_not_found", message: "Content was not found." });
    return item;
  }
  async create(actor: InternalPrincipal, dto: CreateContentDto) {
    if (!validBody(dto.body))
      throw new UnprocessableEntityException({ code: "invalid_editor_document", message: "body must be a schemaVersion 1 document." });
    const type = await this.prisma.cmsContentType.findFirst({ where: { id: dto.contentTypeId, isActive: true } });
    if (!type)
      throw new UnprocessableEntityException({
        code: "content_type_inactive_or_missing",
        message: "Content type must exist and be active.",
      });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.cmsContentItem.create({
          data: {
            contentTypeId: type.id,
            contentKey: dto.contentKey,
            defaultLocale: dto.defaultLocale ?? "en",
            ownerUserId: actor.id,
            status: "DRAFT",
          },
        });
        const revision = await tx.cmsContentRevision.create({
          data: {
            contentItemId: item.id,
            revisionNumber: 1,
            locale: dto.defaultLocale ?? "en",
            title: dto.title,
            slug: dto.slug,
            summary: dto.summary,
            body: dto.body as Prisma.InputJsonValue,
            plainText: plainText(dto.body),
            status: "DRAFT",
            createdByUserId: actor.id,
          },
        });
        await tx.cmsContentItem.update({ where: { id: item.id }, data: { currentRevisionId: revision.id } });
        return { data: { contentId: item.id, revisionId: revision.id, revisionNumber: 1, status: "DRAFT", version: 1 } };
      });
    } catch (error: unknown) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002")
        throw new ConflictException({ code: "content_key_conflict", message: "contentKey already exists." });
      throw error;
    }
  }
  async list(query: ListContentDto) {
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.contentTypeId ? { contentTypeId: query.contentTypeId } : {}),
      ...(query.search
        ? {
            OR: [
              { contentKey: { contains: query.search, mode: "insensitive" as const } },
              { revisions: { some: { title: { contains: query.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.cmsContentItem.findMany({
        where,
        include: { contentType: true, revisions: { orderBy: { revisionNumber: "desc" }, take: 1 } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.cmsContentItem.count({ where }),
    ]);
    return { data: rows, meta: { page: query.page, limit: query.limit, total } };
  }
  async get(id: string) {
    const item = await this.findItem(id);
    return { data: item };
  }
  async update(id: string, dto: UpdateContentDto) {
    if (dto.body && !validBody(dto.body))
      throw new UnprocessableEntityException({ code: "invalid_editor_document", message: "body must be a schemaVersion 1 document." });
    const item = await this.findItem(id);
    const revision = item.revisions.find((x) => x.id === dto.revisionId);
    if (!revision)
      throw new UnprocessableEntityException({ code: "revision_not_owned_by_content", message: "revisionId does not belong to content." });
    if (!editable.includes(revision.status))
      throw new ConflictException({ code: "revision_not_editable", message: "Only editable revisions may be updated." });
    const updated = await this.prisma.cmsContentRevision.updateMany({
      where: { id: revision.id, version: dto.expectedVersion },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.body !== undefined ? { body: dto.body as Prisma.InputJsonValue, plainText: plainText(dto.body) } : {}),
        version: { increment: 1 },
      },
    });
    if (!updated.count)
      throw new ConflictException({ code: "revision_version_conflict", message: "Revision has changed; reload and retry." });
    return this.get(id);
  }
  async remove(id: string) {
    const item = await this.findItem(id);
    if (item.publishedRevisionId || item.revisions.some((x) => x.status !== "DRAFT"))
      throw new UnprocessableEntityException({
        code: "content_cannot_be_deleted",
        message: "Only never-submitted draft content may be deleted.",
      });
    await this.prisma.cmsContentItem.update({ where: { id }, data: { deletedAt: new Date(), status: "DELETED" } });
    return { data: { id, status: "DELETED" } };
  }
  async archive(id: string) {
    await this.findItem(id);
    await this.prisma.cmsContentItem.update({ where: { id }, data: { archivedAt: new Date(), status: "ARCHIVED" } });
    return { data: { id, status: "ARCHIVED" } };
  }
  async restore(id: string) {
    const item = await this.prisma.cmsContentItem.findUnique({ where: { id } });
    if (!item || item.deletedAt) throw new NotFoundException({ code: "content_not_found", message: "Archived content was not found." });
    await this.prisma.cmsContentItem.update({ where: { id }, data: { archivedAt: null, status: "DRAFT" } });
    return { data: { id, status: "DRAFT" } };
  }
}
