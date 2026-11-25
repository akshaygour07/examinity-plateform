import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { PrismaService } from "../../database/prisma.service";
import { ContentService } from "../content/content.service";
import { CreateRevisionDto } from "./revisions.dto";
@Injectable()
export class RevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
  ) {}
  async list(contentId: string) {
    return { data: (await this.content.findItem(contentId)).revisions };
  }
  async get(id: string) {
    const revision = await this.prisma.cmsContentRevision.findUnique({ where: { id } });
    if (!revision) throw new NotFoundException({ code: "revision_not_found", message: "Revision was not found." });
    return { data: revision };
  }
  async create(actor: InternalPrincipal, contentId: string, dto: CreateRevisionDto) {
    const item = await this.content.findItem(contentId);
    const source = item.revisions.find((x) => x.id === dto.sourceRevisionId);
    if (!source)
      throw new UnprocessableEntityException({
        code: "revision_not_owned_by_content",
        message: "sourceRevisionId does not belong to content.",
      });
    const revision = await this.prisma.cmsContentRevision.create({
      data: {
        contentItemId: item.id,
        revisionNumber: Math.max(...item.revisions.map((x) => x.revisionNumber)) + 1,
        locale: dto.locale ?? source.locale,
        title: source.title,
        slug: source.slug,
        summary: source.summary,
        body: source.body as Prisma.InputJsonValue,
        plainText: source.plainText,
        status: "DRAFT",
        createdByUserId: actor.id,
      },
    });
    await this.prisma.cmsContentItem.update({ where: { id: item.id }, data: { currentRevisionId: revision.id, status: "DRAFT" } });
    return { data: revision };
  }
  async compare(id: string, otherId: string) {
    const [left, right] = await Promise.all([this.get(id), this.get(otherId)]);
    return { data: { left: left.data, right: right.data, equal_body: JSON.stringify(left.data.body) === JSON.stringify(right.data.body) } };
  }
}
