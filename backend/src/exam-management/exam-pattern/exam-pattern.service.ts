import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";

type Body = Record<string, unknown>;

@Injectable()
export class ExamPatternService {
  constructor(private readonly prisma: PrismaService) {}

  async cyclePattern(cycleId: string, publicOnly = false) {
    const item = await this.prisma.examPatternVersion.findFirst({
      where: { examCycleId: cycleId, ...(publicOnly ? { publicationStatus: "PUBLISHED" } : {}) },
      include: {
        stages: { include: { papers: { include: { markingScheme: true }, orderBy: { sequence: "asc" } } }, orderBy: { sequence: "asc" } },
      },
      orderBy: { versionNumber: "desc" },
    });
    if (!item) throw new NotFoundException({ code: "exam_pattern_not_found", message: "No examination pattern was found for this cycle." });
    return { data: item };
  }

  async version(id: string) {
    const item = await this.prisma.examPatternVersion.findUnique({
      where: { id },
      include: { stages: { include: { papers: { include: { markingScheme: true } }, orderBy: { sequence: "asc" } } } },
    });
    if (!item) throw new NotFoundException({ code: "exam_pattern_not_found", message: "The examination pattern was not found." });
    return { data: item };
  }

  async create(cycleId: string, body: Body) {
    if (!(await this.prisma.examCycle.findUnique({ where: { id: cycleId } })))
      throw new NotFoundException({ code: "exam_cycle_not_found", message: "The examination cycle was not found." });
    if (typeof body.sourceReferenceId !== "string") throw this.invalid("An official source reference is required for a pattern version.");
    const versionNumber = (await this.prisma.examPatternVersion.count({ where: { examCycleId: cycleId } })) + 1;
    return {
      data: await this.prisma.examPatternVersion.create({
        data: {
          examCycleId: cycleId,
          versionNumber,
          name: this.string(body.name, "Exam pattern"),
          description: this.optionalString(body.description),
          sourceReferenceId: body.sourceReferenceId,
        },
      }),
    };
  }

  async stage(versionId: string, body: Body) {
    await this.editable(versionId);
    const sequence = this.positiveInteger(body.sequence, "sequence");
    const maximumMarks = this.nonNegativeNumber(body.maximumMarks, "maximumMarks");
    const durationMinutes = this.positiveOptionalInteger(body.durationMinutes, "durationMinutes");
    return this.createSafely(() =>
      this.prisma.examStage.create({
        data: {
          patternVersionId: versionId,
          name: this.requiredString(body.name, "name"),
          stageCode: this.optionalString(body.stageCode),
          stageType: this.requiredString(body.stageType, "stageType"),
          description: this.optionalString(body.description),
          sequence,
          isMandatory: body.isMandatory !== false,
          isQualifying: body.isQualifying === true,
          maximumMarks,
          durationMinutes,
          instructions: this.optionalString(body.instructions),
        },
      }),
    );
  }

  async updateStage(id: string, body: Body) {
    const stage = await this.prisma.examStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException({ code: "exam_stage_not_found", message: "The examination stage was not found." });
    await this.editable(stage.patternVersionId);
    const data: Prisma.ExamStageUpdateInput = {
      ...(body.name !== undefined ? { name: this.requiredString(body.name, "name") } : {}),
      ...(body.stageCode !== undefined ? { stageCode: this.optionalString(body.stageCode) } : {}),
      ...(body.stageType !== undefined ? { stageType: this.requiredString(body.stageType, "stageType") } : {}),
      ...(body.description !== undefined ? { description: this.optionalString(body.description) } : {}),
      ...(body.sequence !== undefined ? { sequence: this.positiveInteger(body.sequence, "sequence") } : {}),
      ...(body.isMandatory !== undefined ? { isMandatory: this.boolean(body.isMandatory, "isMandatory") } : {}),
      ...(body.isQualifying !== undefined ? { isQualifying: this.boolean(body.isQualifying, "isQualifying") } : {}),
      ...(body.maximumMarks !== undefined ? { maximumMarks: this.nonNegativeNumber(body.maximumMarks, "maximumMarks") } : {}),
      ...(body.durationMinutes !== undefined
        ? { durationMinutes: this.positiveOptionalInteger(body.durationMinutes, "durationMinutes") }
        : {}),
      ...(body.instructions !== undefined ? { instructions: this.optionalString(body.instructions) } : {}),
    };
    return this.createSafely(() => this.prisma.examStage.update({ where: { id }, data }));
  }

  async deleteStage(id: string) {
    const stage = await this.prisma.examStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException({ code: "exam_stage_not_found", message: "The examination stage was not found." });
    await this.editable(stage.patternVersionId);
    try {
      await this.prisma.examStage.delete({ where: { id } });
    } catch {
      throw new ConflictException({
        code: "exam_stage_in_use",
        message: "A stage containing papers cannot be deleted. Remove its papers first.",
      });
    }
    return { data: { id, deleted: true } };
  }

  async paper(stageId: string, body: Body) {
    const stage = await this.prisma.examStage.findUnique({ where: { id: stageId } });
    if (!stage) throw new NotFoundException({ code: "exam_stage_not_found", message: "The examination stage was not found." });
    await this.editable(stage.patternVersionId);
    const marking = this.markingScheme(body.markingScheme);
    const paper = await this.createSafely(() =>
      this.prisma.examPaper.create({
        data: {
          stageId,
          name: this.requiredString(body.name, "name"),
          paperCode: this.optionalString(body.paperCode),
          subjectName: this.optionalString(body.subjectName),
          totalQuestions: this.positiveOptionalInteger(body.totalQuestions, "totalQuestions"),
          maximumMarks: this.nonNegativeNumber(body.maximumMarks, "maximumMarks"),
          durationMinutes: this.positiveOptionalInteger(body.durationMinutes, "durationMinutes"),
          questionFormat: this.optionalString(body.questionFormat),
          negativeMarkingEnabled: body.negativeMarkingEnabled === true,
          negativeMarkingValue: this.nonNegativeNumber(body.negativeMarkingValue, "negativeMarkingValue"),
          isQualifying: body.isQualifying === true,
          sequence: this.positiveInteger(body.sequence, "sequence"),
          instructions: this.optionalString(body.instructions),
          ...(marking ? { markingScheme: { create: marking } } : {}),
        },
        include: { markingScheme: true },
      }),
    );
    return { data: paper };
  }

  async updatePaper(id: string, body: Body) {
    const paper = await this.prisma.examPaper.findUnique({ where: { id }, include: { stage: true } });
    if (!paper) throw new NotFoundException({ code: "exam_paper_not_found", message: "The examination paper was not found." });
    await this.editable(paper.stage.patternVersionId);
    const data: Prisma.ExamPaperUpdateInput = {
      ...(body.name !== undefined ? { name: this.requiredString(body.name, "name") } : {}),
      ...(body.paperCode !== undefined ? { paperCode: this.optionalString(body.paperCode) } : {}),
      ...(body.subjectName !== undefined ? { subjectName: this.optionalString(body.subjectName) } : {}),
      ...(body.totalQuestions !== undefined ? { totalQuestions: this.positiveOptionalInteger(body.totalQuestions, "totalQuestions") } : {}),
      ...(body.maximumMarks !== undefined ? { maximumMarks: this.nonNegativeNumber(body.maximumMarks, "maximumMarks") } : {}),
      ...(body.durationMinutes !== undefined
        ? { durationMinutes: this.positiveOptionalInteger(body.durationMinutes, "durationMinutes") }
        : {}),
      ...(body.questionFormat !== undefined ? { questionFormat: this.optionalString(body.questionFormat) } : {}),
      ...(body.negativeMarkingEnabled !== undefined
        ? { negativeMarkingEnabled: this.boolean(body.negativeMarkingEnabled, "negativeMarkingEnabled") }
        : {}),
      ...(body.negativeMarkingValue !== undefined
        ? { negativeMarkingValue: this.nonNegativeNumber(body.negativeMarkingValue, "negativeMarkingValue") }
        : {}),
      ...(body.isQualifying !== undefined ? { isQualifying: this.boolean(body.isQualifying, "isQualifying") } : {}),
      ...(body.sequence !== undefined ? { sequence: this.positiveInteger(body.sequence, "sequence") } : {}),
      ...(body.instructions !== undefined ? { instructions: this.optionalString(body.instructions) } : {}),
    };
    const marking = body.markingScheme === undefined ? undefined : this.markingScheme(body.markingScheme);
    return this.createSafely(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.examPaper.update({ where: { id }, data, include: { markingScheme: true } });
        if (marking) await tx.examMarkingScheme.upsert({ where: { paperId: id }, create: { paperId: id, ...marking }, update: marking });
        return tx.examPaper.findUniqueOrThrow({ where: { id }, include: { markingScheme: true } });
      }),
    );
  }

  async reorder(id: string, body: Body) {
    await this.editable(id);
    if (!Array.isArray(body.items)) throw this.invalid("items must be an array of stage IDs and sequence values.");
    const items = body.items.map((item, index) => {
      if (!this.isRecord(item) || typeof item.id !== "string") throw this.invalid(`items[${index}] must include a stage id.`);
      return { id: item.id, sequence: this.positiveInteger(item.sequence, `items[${index}].sequence`) };
    });
    if (new Set(items.map((item) => item.id)).size !== items.length || new Set(items.map((item) => item.sequence)).size !== items.length)
      throw this.invalid("Stage IDs and sequence values must be unique.");
    const existing = await this.prisma.examStage.findMany({ where: { patternVersionId: id }, select: { id: true } });
    if (existing.length !== items.length || existing.some((stage) => !items.some((item) => item.id === stage.id)))
      throw this.invalid("Reorder must include every stage in the pattern version exactly once.");
    await this.prisma.$transaction(async (tx) => {
      for (const [index, item] of items.entries()) await tx.examStage.update({ where: { id: item.id }, data: { sequence: -(index + 1) } });
      for (const item of items) await tx.examStage.update({ where: { id: item.id }, data: { sequence: item.sequence } });
    });
    return this.version(id);
  }

  async validate(id: string) {
    const { data } = await this.version(id);
    const issues: string[] = [];
    if (!data.sourceReferenceId) issues.push("An official source reference is required.");
    if (!data.stages.length) issues.push("At least one examination stage is required.");
    for (const stage of data.stages) {
      if (!stage.papers.length) issues.push(`Stage ${stage.name} must contain at least one paper.`);
      if (stage.maximumMarks !== null && Number(stage.maximumMarks) <= 0)
        issues.push(`Stage ${stage.name} must have positive maximum marks.`);
      if (stage.durationMinutes !== null && stage.durationMinutes <= 0) issues.push(`Stage ${stage.name} must have positive duration.`);
      for (const paper of stage.papers) {
        if (paper.maximumMarks !== null && Number(paper.maximumMarks) <= 0)
          issues.push(`Paper ${paper.name} must have positive maximum marks.`);
        if (paper.durationMinutes !== null && paper.durationMinutes <= 0) issues.push(`Paper ${paper.name} must have positive duration.`);
        if (paper.negativeMarkingValue !== null && Number(paper.negativeMarkingValue) < 0)
          issues.push(`Paper ${paper.name} cannot have a negative deduction value.`);
        if (paper.negativeMarkingEnabled && paper.negativeMarkingValue === null && paper.markingScheme?.incorrectMarks == null)
          issues.push(`Paper ${paper.name} enables negative marking but has no incorrect-answer deduction.`);
      }
    }
    return { data: { valid: issues.length === 0, issues } };
  }

  private async editable(id: string) {
    const version = await this.prisma.examPatternVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException({ code: "exam_pattern_not_found", message: "The examination pattern was not found." });
    if (version.publicationStatus !== "DRAFT")
      throw new ConflictException({ code: "pattern_version_immutable", message: "Only draft pattern versions can be edited." });
  }
  private markingScheme(value: unknown): Prisma.ExamMarkingSchemeCreateWithoutPaperInput | null {
    if (value === undefined || value === null) return null;
    if (!this.isRecord(value)) throw this.invalid("markingScheme must be an object.");
    const calculationType = this.requiredString(value.calculationType, "markingScheme.calculationType");
    return {
      calculationType,
      correctMarks: this.nonNegativeNumber(value.correctMarks, "markingScheme.correctMarks"),
      incorrectMarks: this.nonNegativeNumber(value.incorrectMarks, "markingScheme.incorrectMarks"),
      unansweredMarks: this.nonNegativeNumber(value.unansweredMarks, "markingScheme.unansweredMarks"),
      configuration: value.configuration as Prisma.InputJsonValue | undefined,
    };
  }
  private async createSafely<T>(operation: () => Promise<T>): Promise<{ data: T }> {
    try {
      return { data: await operation() };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof UnprocessableEntityException || error instanceof NotFoundException)
        throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException({ code: "exam_pattern_sequence_conflict", message: "The stage or paper sequence is already in use." });
      throw error;
    }
  }
  private requiredString(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim()) throw this.invalid(`${field} is required.`);
    return value.trim();
  }
  private optionalString(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") throw this.invalid("String fields must contain text.");
    return value.trim();
  }
  private string(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }
  private boolean(value: unknown, field: string) {
    if (typeof value !== "boolean") throw this.invalid(`${field} must be a boolean.`);
    return value;
  }
  private positiveInteger(value: unknown, field: string) {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw this.invalid(`${field} must be a positive integer.`);
    return value;
  }
  private positiveOptionalInteger(value: unknown, field: string) {
    if (value === null || value === undefined || value === "") return null;
    return this.positiveInteger(value, field);
  }
  private nonNegativeNumber(value: unknown, field: string) {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (!Number.isFinite(number) || number < 0) throw this.invalid(`${field} must be a non-negative number.`);
    return number;
  }
  private isRecord(value: unknown): value is Body {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  private invalid(message: string) {
    return new UnprocessableEntityException({ code: "exam_pattern_invalid", message });
  }
}
