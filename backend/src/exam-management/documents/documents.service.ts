import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

export type ContentKind = "document" | "link" | "faq";
type ContentRecord = Record<string, unknown> & { id: string };
type ContentDelegate = {
  findMany(args: { where: Record<string, unknown>; orderBy: { displayOrder: "asc" } }): Promise<ContentRecord[]>;
  findUnique(args: { where: { id: string } }): Promise<ContentRecord | null>;
  create(args: { data: Record<string, unknown> }): Promise<ContentRecord>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<ContentRecord>;
};

const fields: Record<ContentKind, { required: string[]; allowed: string[] }> = {
  document: {
    required: ["documentTitle", "documentType"],
    allowed: ["documentTitle", "documentType", "mediaId", "externalUrl", "sourceReferenceId", "displayOrder", "examCycleId"],
  },
  link: {
    required: ["title", "url", "linkType"],
    allowed: ["title", "url", "linkType", "sourceReferenceId", "displayOrder", "examCycleId", "isActive"],
  },
  faq: { required: ["question", "answer"], allowed: ["question", "answer", "languageCode", "displayOrder", "examCycleId"] },
};

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(kind: ContentKind, examId: string, publicOnly = false) {
    await this.exam(examId);
    const visible =
      kind === "document"
        ? { status: "ACTIVE", verificationStatus: "VERIFIED" }
        : kind === "link"
          ? { isActive: true }
          : { status: "PUBLISHED" };
    return {
      data: await this.delegate(kind).findMany({ where: { examId, ...(publicOnly ? visible : {}) }, orderBy: { displayOrder: "asc" } }),
    };
  }

  async create(kind: ContentKind, examId: string, body: Record<string, unknown>) {
    await this.exam(examId);
    const data = await this.data(kind, body, true, examId);
    return { data: await this.delegate(kind).create({ data: { examId, ...data } }) };
  }

  async update(kind: ContentKind, id: string, body: Record<string, unknown>) {
    const current = await this.delegate(kind).findUnique({ where: { id } });
    if (!current) throw this.notFound(kind);
    const priorFields = Object.fromEntries(
      fields[kind].allowed.filter((field) => field in current).map((field) => [field, current[field]]),
    );
    const data = await this.data(kind, { ...priorFields, ...body }, false, String(current.examId));
    return { data: await this.delegate(kind).update({ where: { id }, data }) };
  }

  private delegate(kind: ContentKind): ContentDelegate {
    switch (kind) {
      case "document":
        return this.prisma.examDocument as unknown as ContentDelegate;
      case "link":
        return this.prisma.examLink as unknown as ContentDelegate;
      case "faq":
        return this.prisma.examFaq as unknown as ContentDelegate;
    }
  }

  private async data(kind: ContentKind, body: Record<string, unknown>, create: boolean, examId: string): Promise<Record<string, unknown>> {
    const definition = fields[kind];
    for (const field of Object.keys(body))
      if (!definition.allowed.includes(field)) throw this.invalid(`Field ${field} cannot be set for this content type.`);
    const data: Record<string, unknown> = {};
    for (const field of definition.allowed) {
      const value = body[field];
      if (value === undefined) {
        if (create && definition.required.includes(field)) throw this.invalid(`${field} is required.`);
        continue;
      }
      if (field === "displayOrder") {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
          throw this.invalid("displayOrder must be a non-negative integer.");
        data[field] = value;
      } else if (field === "isActive") {
        if (typeof value !== "boolean") throw this.invalid("isActive must be a boolean.");
        data[field] = value;
      } else if (field === "mediaId" || field === "sourceReferenceId" || field === "examCycleId") {
        if (value !== null && (typeof value !== "string" || !this.isUuid(value))) throw this.invalid(`${field} must be a UUID or null.`);
        data[field] = value;
      } else if (field === "externalUrl" && value === null) {
        data[field] = null;
      } else {
        if (typeof value !== "string" || !value.trim()) throw this.invalid(`${field} must be a non-empty string.`);
        data[field] = value.trim();
      }
    }
    if (kind === "document") {
      const mediaId = body.mediaId;
      const externalUrl = body.externalUrl;
      if (create && !mediaId && !externalUrl) throw this.invalid("Provide either mediaId or externalUrl.");
      if (mediaId && externalUrl) throw this.invalid("Provide mediaId or externalUrl, not both.");
      if (externalUrl !== undefined) {
        if (typeof externalUrl !== "string") throw this.invalid("externalUrl must be a valid HTTP or HTTPS URL.");
        try {
          const url = new URL(externalUrl);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          throw this.invalid("externalUrl must be a valid HTTP or HTTPS URL.");
        }
        data.externalUrl = externalUrl;
      }
    }
    if (body.examCycleId) {
      const cycle = await this.prisma.examCycle.findUnique({ where: { id: String(body.examCycleId) } });
      if (!cycle || cycle.examId !== examId) throw this.invalid("examCycleId must belong to the selected examination.");
    }
    return data;
  }

  private async exam(id: string) {
    if (!(await this.prisma.exam.findUnique({ where: { id } })))
      throw new NotFoundException({ code: "exam_not_found", message: "The examination was not found." });
  }
  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
  private invalid(message: string) {
    return new BadRequestException({ code: "invalid_exam_content", message });
  }
  private notFound(kind: ContentKind) {
    return new NotFoundException({ code: `exam_${kind}_not_found`, message: "The requested examination content was not found." });
  }
}
