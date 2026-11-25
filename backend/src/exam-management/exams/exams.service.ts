/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma delegates are intentionally selected by validated M2 resource names. */
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../../audit/audit.service";
import type { InternalPrincipal } from "../../auth/auth0.guard";
import { AliasDto, BodyDto, CycleDto, ExamDto, ExamQueryDto, TaxonomyDto } from "./dto/exam-management.dto";

const normalized = (value: string) => value.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
const audit = { requestId: "m2-api", result: "SUCCESS" } as const;
const conflict = (message: string) => new ConflictException({ code: "m2_version_or_uniqueness_conflict", message });

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audits: AuditService,
  ) {}
  private async log(actor: InternalPrincipal, action: string, type: string, id: string, metadata: object, tx?: Prisma.TransactionClient) {
    try {
      await this.audits.record({ actorUserId: actor.id, action, resourceType: type, resourceId: id, metadata, ...audit }, tx);
    } catch (error) {
      // A successful M2 write must return its created resource even when the
      // separate audit sink is temporarily unavailable. The failure remains
      // visible to operators in application logs and does not leave clients
      // retrying a request that has already committed.
      this.logger.error(`Audit write failed after ${action} for ${type} ${id}`, error instanceof Error ? error.stack : String(error));
    }
  }
  private async exists(model: "examCategory" | "examGroup" | "state" | "examBody" | "exam", ids: string[], active = false) {
    if (!ids.length) return;
    const count = await (this.prisma[model] as any).count({ where: { id: { in: ids }, ...(active ? { status: "ACTIVE" } : {}) } });
    if (count !== ids.length)
      throw new NotFoundException({ code: "referenced_record_not_found", message: "A referenced record does not exist or is not active." });
  }
  private taxonomyModel(kind: "category" | "group") {
    return kind === "category" ? this.prisma.examCategory : this.prisma.examGroup;
  }
  async listTaxonomy(kind: "category" | "group", publicOnly = false) {
    const model = this.taxonomyModel(kind) as any;
    const items = await model.findMany({
      where: publicOnly ? { status: "ACTIVE", archivedAt: null } : {},
      include: kind === "group" ? { category: true } : undefined,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return { data: items };
  }
  async createTaxonomy(kind: "category" | "group", dto: TaxonomyDto, actor: InternalPrincipal) {
    if (kind === "group" && dto.category_id) await this.exists("examCategory", [dto.category_id], true);
    try {
      const item = await (kind === "category"
        ? this.prisma.examCategory.create({
            data: {
              name: dto.name.trim(),
              slug: normalized(dto.slug),
              description: dto.description,
              displayOrder: dto.display_order,
              status: dto.status,
            },
          })
        : this.prisma.examGroup.create({
            data: {
              name: dto.name.trim(),
              slug: normalized(dto.slug),
              description: dto.description,
              displayOrder: dto.display_order,
              status: dto.status,
              categoryId: dto.category_id ?? null,
            },
          }));
      await this.log(actor, `EXAM_${kind.toUpperCase()}_CREATED`, `exam_${kind}`, item.id, { name: item.name });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("Name or slug already exists.");
      throw e;
    }
  }
  async updateTaxonomy(kind: "category" | "group", id: string, dto: TaxonomyDto, actor: InternalPrincipal) {
    const model = this.taxonomyModel(kind) as any;
    const current = await model.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (dto.expected_version !== undefined && dto.expected_version !== current.version)
      throw conflict("expected_version must match the current version.");
    if (kind === "group" && dto.category_id) await this.exists("examCategory", [dto.category_id], true);
    try {
      const item = await model.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.slug !== undefined ? { slug: normalized(dto.slug) } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.display_order !== undefined ? { displayOrder: dto.display_order } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(kind === "group" && dto.category_id !== undefined ? { categoryId: dto.category_id } : {}),
          version: { increment: 1 },
        },
      });
      await this.log(actor, `EXAM_${kind.toUpperCase()}_UPDATED`, `exam_${kind}`, id, { previous_version: current.version });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("Name or slug already exists.");
      throw e;
    }
  }
  async archiveTaxonomy(kind: "category" | "group", id: string, actor: InternalPrincipal) {
    const model = this.taxonomyModel(kind) as any;
    const item = await model
      .update({ where: { id }, data: { status: "INACTIVE", archivedAt: new Date(), version: { increment: 1 } } })
      .catch(() => null);
    if (!item) throw new NotFoundException();
    await this.log(actor, `EXAM_${kind.toUpperCase()}_ARCHIVED`, `exam_${kind}`, id, {});
    return { data: item };
  }
  async states(publicOnly = false) {
    return {
      data: await this.prisma.state.findMany({
        where: publicOnly ? { status: "ACTIVE" } : {},
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      }),
    };
  }
  async bodies(publicOnly = false) {
    return { data: await this.prisma.examBody.findMany({ where: publicOnly ? { status: "ACTIVE" } : {}, orderBy: { name: "asc" } }) };
  }
  async createBody(dto: BodyDto, actor: InternalPrincipal) {
    try {
      const item = await this.prisma.examBody.create({
        data: {
          name: dto.name.trim(),
          shortName: dto.short_name,
          slug: normalized(dto.slug),
          description: dto.description,
          officialWebsite: dto.official_website,
          logoMediaId: dto.logo_media_id,
          status: dto.status,
        },
      });
      await this.log(actor, "EXAM_BODY_CREATED", "exam_body", item.id, { name: item.name });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("Authority name or slug already exists.");
      throw e;
    }
  }
  async updateBody(id: string, dto: BodyDto, actor: InternalPrincipal) {
    const current = await this.prisma.examBody.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (dto.expected_version !== undefined && dto.expected_version !== current.version)
      throw conflict("expected_version must match the current version.");
    const item = await this.prisma.examBody.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.short_name !== undefined ? { shortName: dto.short_name } : {}),
        ...(dto.slug !== undefined ? { slug: normalized(dto.slug) } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.official_website !== undefined ? { officialWebsite: dto.official_website } : {}),
        ...(dto.logo_media_id !== undefined ? { logoMediaId: dto.logo_media_id } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        version: { increment: 1 },
      },
    });
    await this.log(actor, "EXAM_BODY_UPDATED", "exam_body", id, { previous_version: current.version });
    return { data: item };
  }
  private examInclude = {
    body: true,
    aliases: true,
    categoryMappings: { include: { category: true } },
    groupMappings: { include: { group: true } },
    stateMappings: { include: { state: true } },
    cycles: { orderBy: { cycleYear: "desc" as const } },
  };
  async listExams(query: ExamQueryDto, publicOnly = false) {
    const limit = Math.min(query.limit ?? 20, 100);
    const where: any = {
      ...(publicOnly ? { status: "ACTIVE", archivedAt: null } : {}),
      ...(query.exam_body_id ? { examBodyId: query.exam_body_id } : {}),
      ...(query.scope ? { examScope: query.scope } : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.category_id ? { categoryMappings: { some: { categoryId: query.category_id } } } : {}),
      ...(query.group_id ? { groupMappings: { some: { groupId: query.group_id } } } : {}),
      ...(query.state_id ? { stateMappings: { some: { stateId: query.state_id } } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { shortName: { contains: query.q, mode: "insensitive" } },
              { aliases: { some: { normalizedAlias: { contains: normalized(query.q) } } } },
            ],
          }
        : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.exam.count({ where }),
      this.prisma.exam.findMany({
        where,
        include: this.examInclude,
        orderBy: [{ isFeatured: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data, pagination: { page: query.page, limit, total } };
  }
  async getExam(id: string, publicOnly = false) {
    const item = await this.prisma.exam.findFirst({
      where: { ...(publicOnly ? { slug: id, status: "ACTIVE", archivedAt: null } : { id }) },
      include: this.examInclude,
    });
    if (!item) throw new NotFoundException({ code: "exam_not_found", message: "The examination was not found." });
    return { data: item };
  }
  async createExam(dto: ExamDto, actor: InternalPrincipal) {
    await this.exists("examBody", [dto.exam_body_id], true);
    await this.exists("examCategory", dto.category_ids, true);
    await this.exists("examGroup", dto.group_ids ?? [], true);
    await this.exists("state", dto.state_ids ?? [], true);
    if (dto.primary_state_id && !dto.state_ids?.includes(dto.primary_state_id))
      throw conflict("primary_state_id must be included in state_ids.");
    try {
      const item = await this.prisma.exam.create({
        data: {
          name: dto.name.trim(),
          shortName: dto.short_name,
          slug: normalized(dto.slug),
          description: dto.description,
          examBodyId: dto.exam_body_id,
          examScope: dto.exam_scope,
          examMode: dto.exam_mode,
          officialWebsite: dto.official_website,
          logoMediaId: dto.logo_media_id,
          isFeatured: dto.is_featured,
          displayOrder: dto.display_order,
          status: dto.status ?? "DRAFT",
          categoryMappings: { create: dto.category_ids.map((categoryId) => ({ categoryId })) },
          groupMappings: { create: (dto.group_ids ?? []).map((groupId) => ({ groupId })) },
          stateMappings: { create: (dto.state_ids ?? []).map((stateId) => ({ stateId, isPrimary: stateId === dto.primary_state_id })) },
        },
        include: this.examInclude,
      });
      await this.log(actor, "EXAM_CREATED", "exam", item.id, { name: item.name });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("Examination slug already exists.");
      throw e;
    }
  }
  async updateExam(id: string, dto: ExamDto, actor: InternalPrincipal) {
    const current = await this.prisma.exam.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (dto.expected_version === undefined || dto.expected_version !== current.version)
      throw conflict("expected_version is required and must match the current version.");
    await this.exists("examBody", [dto.exam_body_id], true);
    await this.exists("examCategory", dto.category_ids, true);
    await this.exists("examGroup", dto.group_ids ?? [], true);
    await this.exists("state", dto.state_ids ?? [], true);
    if (dto.primary_state_id && !dto.state_ids?.includes(dto.primary_state_id))
      throw conflict("primary_state_id must be included in state_ids.");
    const item = await this.prisma.exam.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        shortName: dto.short_name,
        slug: normalized(dto.slug),
        description: dto.description,
        examBodyId: dto.exam_body_id,
        examScope: dto.exam_scope,
        examMode: dto.exam_mode,
        officialWebsite: dto.official_website,
        logoMediaId: dto.logo_media_id,
        isFeatured: dto.is_featured,
        displayOrder: dto.display_order,
        status: dto.status,
        version: { increment: 1 },
        categoryMappings: { deleteMany: {}, create: dto.category_ids.map((categoryId) => ({ categoryId })) },
        groupMappings: { deleteMany: {}, create: (dto.group_ids ?? []).map((groupId) => ({ groupId })) },
        stateMappings: {
          deleteMany: {},
          create: (dto.state_ids ?? []).map((stateId) => ({ stateId, isPrimary: stateId === dto.primary_state_id })),
        },
      },
      include: this.examInclude,
    });
    await this.log(actor, "EXAM_UPDATED", "exam", id, { previous_version: current.version });
    return { data: item };
  }
  async setExamStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ARCHIVED", actor: InternalPrincipal) {
    const item = await this.prisma.exam
      .update({
        where: { id },
        data:
          status === "ARCHIVED"
            ? { status: "INACTIVE", archivedAt: new Date(), version: { increment: 1 } }
            : { status, version: { increment: 1 } },
      })
      .catch(() => null);
    if (!item) throw new NotFoundException();
    await this.log(actor, `EXAM_${status}`, "exam", id, {});
    return { data: item };
  }
  async aliases(examId: string) {
    await this.getExam(examId);
    return { data: await this.prisma.examAlias.findMany({ where: { examId }, orderBy: { alias: "asc" } }) };
  }
  async addAlias(examId: string, dto: AliasDto, actor: InternalPrincipal) {
    await this.getExam(examId);
    try {
      const item = await this.prisma.examAlias.create({
        data: { examId, alias: dto.alias.trim(), normalizedAlias: normalized(dto.alias), languageCode: dto.language_code ?? "en" },
      });
      await this.log(actor, "EXAM_ALIAS_ADDED", "exam_alias", item.id, { exam_id: examId });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("This alias is already assigned to an examination.");
      throw e;
    }
  }
  async removeAlias(examId: string, aliasId: string, actor: InternalPrincipal) {
    const item = await this.prisma.examAlias.delete({ where: { id: aliasId } }).catch(() => null);
    if (!item || item.examId !== examId) throw new NotFoundException();
    await this.log(actor, "EXAM_ALIAS_REMOVED", "exam_alias", aliasId, { exam_id: examId });
    return { data: item };
  }
  async cycles(examId: string, publicOnly = false) {
    await this.getExam(examId, publicOnly);
    return {
      data: await this.prisma.examCycle.findMany({
        where: { examId, ...(publicOnly ? { publicationStatus: "PUBLISHED", archivedAt: null } : {}) },
        orderBy: [{ cycleYear: "desc" }, { cycleCode: "asc" }],
      }),
    };
  }
  async createCycle(examId: string, dto: CycleDto, actor: InternalPrincipal) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
    if (!exam || exam.archivedAt)
      throw new NotFoundException({ code: "exam_not_found", message: "The examination is not available for a cycle." });
    try {
      const item = await this.prisma.examCycle.create({
        data: {
          examId,
          cycleYear: dto.cycle_year,
          cycleCode: dto.cycle_code.trim(),
          cycleLabel: dto.cycle_label.trim(),
          vacancyCount: dto.vacancy_count,
          notificationReference: dto.notification_reference,
          cycleStatus: dto.cycle_status,
          publicationStatus: dto.publication_status,
        },
      });
      await this.log(actor, "EXAM_CYCLE_CREATED", "exam_cycle", item.id, { exam_id: examId, cycle_code: item.cycleCode });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("cycle_code must be unique within the examination.");
      throw e;
    }
  }
  async getCycle(id: string, publicOnly = false) {
    const item = await this.prisma.examCycle.findFirst({
      where: {
        id,
        ...(publicOnly ? { publicationStatus: "PUBLISHED", archivedAt: null, exam: { status: "ACTIVE", archivedAt: null } } : {}),
      },
      include: { exam: { include: { body: true } } },
    });
    if (!item) throw new NotFoundException({ code: "exam_cycle_not_found", message: "The examination cycle was not found." });
    return { data: item };
  }
  async updateCycle(id: string, dto: CycleDto, actor: InternalPrincipal) {
    const current = await this.prisma.examCycle.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    if (dto.expected_version === undefined || dto.expected_version !== current.version)
      throw conflict("expected_version is required and must match the current version.");
    try {
      const item = await this.prisma.examCycle.update({
        where: { id },
        data: {
          cycleYear: dto.cycle_year,
          cycleCode: dto.cycle_code.trim(),
          cycleLabel: dto.cycle_label.trim(),
          vacancyCount: dto.vacancy_count,
          notificationReference: dto.notification_reference,
          cycleStatus: dto.cycle_status,
          publicationStatus: dto.publication_status,
          version: { increment: 1 },
        },
      });
      await this.log(actor, "EXAM_CYCLE_UPDATED", "exam_cycle", id, { previous_version: current.version });
      return { data: item };
    } catch (e: any) {
      if (e.code === "P2002") throw conflict("cycle_code must be unique within the examination.");
      throw e;
    }
  }
  async archiveCycle(id: string, actor: InternalPrincipal) {
    const item = await this.prisma.examCycle
      .update({ where: { id }, data: { archivedAt: new Date(), cycleStatus: "ARCHIVED", version: { increment: 1 } } })
      .catch(() => null);
    if (!item) throw new NotFoundException();
    await this.log(actor, "EXAM_CYCLE_ARCHIVED", "exam_cycle", id, {});
    return { data: item };
  }

  async exportWorkbook(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, include: this.examInclude });
    if (!exam) throw new NotFoundException({ code: "exam_not_found", message: "The examination was not found." });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Examination");
    sheet.columns = [{ header: "Field", key: "field", width: 28 }, { header: "Value", key: "value", width: 70 }];
    Object.entries({ id: exam.id, name: exam.name, slug: exam.slug, status: exam.status, authority: exam.body.name, scope: exam.examScope, mode: exam.examMode }).forEach(([field, value]) => sheet.addRow({ field, value: value ?? "" }));
    const cycles = workbook.addWorksheet("Cycles");
    cycles.columns = [{ header: "Year", key: "year", width: 12 }, { header: "Code", key: "code", width: 22 }, { header: "Label", key: "label", width: 35 }, { header: "Status", key: "status", width: 24 }];
    exam.cycles.forEach((item) => cycles.addRow({ year: item.cycleYear, code: item.cycleCode, label: item.cycleLabel, status: item.cycleStatus }));
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
