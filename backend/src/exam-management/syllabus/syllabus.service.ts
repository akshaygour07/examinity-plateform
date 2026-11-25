import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import {
  CreateSyllabusDto,
  CreateSyllabusPaperDto,
  CreateSyllabusStageDto,
  CreateSyllabusSubjectDto,
  CreateSyllabusTopicDto,
  CreateSyllabusVersionDto,
  UpdateSyllabusTopicDto,
} from "./dto/syllabus.dto";

const tree = {
  stages: {
    orderBy: { sequence: "asc" as const },
    include: {
      papers: {
        orderBy: { sequence: "asc" as const },
        include: {
          subjects: {
            orderBy: { sequence: "asc" as const },
            include: { topics: { orderBy: { displayOrder: "asc" as const }, include: { translations: true } } },
          },
        },
      },
    },
  },
};
@Injectable()
export class SyllabusService {
  constructor(private readonly prisma: PrismaService) {}
  async publicByCycle(cycleId: string) {
    const version = await this.prisma.syllabusVersion.findFirst({
      where: { syllabus: { examCycleId: cycleId, status: "ACTIVE" }, publicationStatus: "PUBLISHED" },
      orderBy: { versionNumber: "desc" },
      include: { syllabus: true, ...tree },
    });
    if (!version) throw this.notFound("syllabus_not_found", "No published syllabus was found for this examination cycle.");
    return { data: version };
  }
  async publicVersion(id: string) {
    const version = await this.prisma.syllabusVersion.findFirst({
      where: { id, publicationStatus: "PUBLISHED", syllabus: { status: "ACTIVE" } },
      include: { syllabus: true, ...tree },
    });
    if (!version) throw this.notFound("syllabus_version_not_found", "The published syllabus version was not found.");
    return { data: version };
  }
  async adminByCycle(cycleId: string) {
    await this.cycle(cycleId);
    return {
      data: await this.prisma.syllabus.findUnique({
        where: { examCycleId: cycleId },
        include: { versions: { orderBy: { versionNumber: "desc" }, include: tree } },
      }),
    };
  }
  async createSyllabus(cycleId: string, dto: CreateSyllabusDto) {
    await this.cycle(cycleId);
    try {
      return { data: await this.prisma.syllabus.create({ data: { examCycleId: cycleId, ...dto } }) };
    } catch {
      throw new ConflictException({ code: "syllabus_already_exists", message: "A syllabus already exists for this examination cycle." });
    }
  }
  async createVersion(syllabusId: string, dto: CreateSyllabusVersionDto) {
    const syllabus = await this.prisma.syllabus.findUnique({ where: { id: syllabusId } });
    if (!syllabus) throw this.notFound("syllabus_not_found", "The syllabus was not found.");
    const [number, previous] = await Promise.all([
      this.prisma.syllabusVersion.count({ where: { syllabusId } }).then((count) => count + 1),
      this.prisma.syllabusVersion.findFirst({
        where: { syllabusId, publicationStatus: "PUBLISHED" },
        orderBy: { versionNumber: "desc" },
        include: tree,
      }),
    ]);
    const created = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.syllabusVersion.create({
        data: {
          syllabusId,
          versionNumber: number,
          versionLabel: dto.versionLabel,
          languageDefault: dto.languageDefault ?? previous?.languageDefault ?? "en",
          sourceReferenceId: dto.sourceReferenceId ?? previous?.sourceReferenceId ?? null,
          officialDocumentId: dto.officialDocumentId ?? previous?.officialDocumentId ?? null,
        },
      });
      if (!previous) return draft;

      for (const stage of previous.stages) {
        const newStage = await tx.syllabusStage.create({
          data: { syllabusVersionId: draft.id, examStageId: stage.examStageId, name: stage.name, sequence: stage.sequence },
        });
        for (const paper of stage.papers) {
          const newPaper = await tx.syllabusPaper.create({
            data: { syllabusStageId: newStage.id, examPaperId: paper.examPaperId, name: paper.name, sequence: paper.sequence },
          });
          for (const subject of paper.subjects) {
            const newSubject = await tx.syllabusSubject.create({
              data: { syllabusPaperId: newPaper.id, name: subject.name, description: subject.description, sequence: subject.sequence },
            });
            const topicIds = new Map<string, string>();
            for (const topic of [...subject.topics].sort(
              (left, right) => left.depthLevel - right.depthLevel || left.displayOrder - right.displayOrder,
            )) {
              const newTopic = await tx.syllabusTopic.create({
                data: {
                  syllabusSubjectId: newSubject.id,
                  parentTopicId: topic.parentTopicId ? (topicIds.get(topic.parentTopicId) ?? null) : null,
                  name: topic.name,
                  description: topic.description,
                  topicCode: topic.topicCode,
                  depthLevel: topic.depthLevel,
                  displayOrder: topic.displayOrder,
                  status: topic.status,
                  translations: topic.translations.length
                    ? { create: topic.translations.map(({ languageCode, name, description }) => ({ languageCode, name, description })) }
                    : undefined,
                },
              });
              topicIds.set(topic.id, newTopic.id);
            }
          }
        }
      }
      return draft;
    });
    return { data: created };
  }
  async adminVersion(id: string) {
    return { data: await this.version(id) };
  }
  async addStage(versionId: string, dto: CreateSyllabusStageDto) {
    await this.editable(versionId);
    return { data: await this.prisma.syllabusStage.create({ data: { syllabusVersionId: versionId, ...dto } }) };
  }
  async addPaper(stageId: string, dto: CreateSyllabusPaperDto) {
    const stage = await this.prisma.syllabusStage.findUnique({ where: { id: stageId } });
    if (!stage) throw this.notFound("syllabus_stage_not_found", "The syllabus stage was not found.");
    await this.editable(stage.syllabusVersionId);
    return { data: await this.prisma.syllabusPaper.create({ data: { syllabusStageId: stageId, ...dto } }) };
  }
  async addSubject(paperId: string, dto: CreateSyllabusSubjectDto) {
    const paper = await this.prisma.syllabusPaper.findUnique({ where: { id: paperId }, include: { stage: true } });
    if (!paper) throw this.notFound("syllabus_paper_not_found", "The syllabus paper was not found.");
    await this.editable(paper.stage.syllabusVersionId);
    return { data: await this.prisma.syllabusSubject.create({ data: { syllabusPaperId: paperId, ...dto } }) };
  }
  async addTopic(subjectId: string, dto: CreateSyllabusTopicDto) {
    return { data: await this.createTopic(subjectId, dto) };
  }
  async addChild(topicId: string, dto: CreateSyllabusTopicDto) {
    const parent = await this.topic(topicId);
    return { data: await this.createTopic(parent.syllabusSubjectId, { ...dto, parentTopicId: topicId }) };
  }
  async updateTopic(topicId: string, dto: UpdateSyllabusTopicDto) {
    const current = await this.topic(topicId);
    await this.editableForSubject(current.syllabusSubjectId);
    if (dto.parentTopicId !== undefined) await this.validParent(current.syllabusSubjectId, dto.parentTopicId, topicId);
    if (dto.topicCode) await this.uniqueCode(current.syllabusSubjectId, dto.topicCode, topicId);
    const { translations, ...data } = dto;
    const item = await this.prisma.$transaction(async (tx) => {
      const topic = await tx.syllabusTopic.update({ where: { id: topicId }, data });
      if (translations)
        for (const t of translations)
          await tx.syllabusTopicTranslation.upsert({
            where: { syllabusTopicId_languageCode: { syllabusTopicId: topicId, languageCode: t.languageCode } },
            create: { syllabusTopicId: topicId, ...t },
            update: t,
          });
      return topic;
    });
    return { data: item };
  }
  async validate(id: string) {
    const v = await this.version(id);
    const issues: string[] = [];
    if (!v.sourceReferenceId) issues.push("An official source reference is required.");
    if (!v.stages.length) issues.push("At least one syllabus stage is required.");
    for (const s of v.stages) {
      if (!s.papers.length) issues.push(`Stage ${s.name} has no paper.`);
      for (const p of s.papers) {
        if (!p.subjects.length) issues.push(`Paper ${p.name} has no subject.`);
        for (const sub of p.subjects) if (!sub.topics.length) issues.push(`Subject ${sub.name} has no topic.`);
      }
    }
    return { data: { valid: issues.length === 0, issues } };
  }
  async publish(id: string) {
    await this.editable(id);
    const result = await this.validate(id);
    if (!result.data.valid)
      throw new UnprocessableEntityException({
        code: "syllabus_not_ready_to_publish",
        message: "The syllabus cannot be published until its hierarchy is complete.",
        details: { issues: result.data.issues },
      });
    return {
      data: await this.prisma.syllabusVersion.update({ where: { id }, data: { publicationStatus: "PUBLISHED", publishedAt: new Date() } }),
    };
  }
  private async createTopic(subjectId: string, dto: CreateSyllabusTopicDto) {
    await this.editableForSubject(subjectId);
    await this.validParent(subjectId, dto.parentTopicId);
    if (dto.topicCode) await this.uniqueCode(subjectId, dto.topicCode);
    const { translations, parentTopicId, ...data } = dto;
    const depthLevel = parentTopicId ? (await this.topic(parentTopicId)).depthLevel + 1 : 1;
    return this.prisma.syllabusTopic.create({
      data: {
        syllabusSubjectId: subjectId,
        parentTopicId: parentTopicId ?? null,
        depthLevel,
        ...data,
        translations: translations ? { create: translations } : undefined,
      },
      include: { translations: true },
    });
  }
  private async validParent(subjectId: string, parentId?: string | null, selfId?: string) {
    if (!parentId) return;
    if (parentId === selfId)
      throw new UnprocessableEntityException({ code: "syllabus_circular_reference", message: "A topic cannot be its own parent." });
    const parent = await this.topic(parentId);
    if (parent.syllabusSubjectId !== subjectId)
      throw new UnprocessableEntityException({
        code: "syllabus_parent_invalid",
        message: "The parent topic must belong to the same syllabus subject.",
      });
    if (selfId) {
      let id: string | null = parent.id;
      while (id) {
        if (id === selfId)
          throw new UnprocessableEntityException({
            code: "syllabus_circular_reference",
            message: "The selected parent would create a circular hierarchy.",
          });
        id = (await this.topic(id)).parentTopicId;
      }
    }
  }
  private async uniqueCode(subjectId: string, code: string, except?: string) {
    const found = await this.prisma.syllabusTopic.findFirst({
      where: { syllabusSubjectId: subjectId, topicCode: code, ...(except ? { id: { not: except } } : {}) },
    });
    if (found)
      throw new ConflictException({
        code: "syllabus_topic_code_duplicate",
        message: "Topic code already exists in this syllabus subject.",
      });
  }
  private async editable(id: string) {
    const version = await this.version(id);
    if (version.publicationStatus !== "DRAFT")
      throw new ConflictException({ code: "syllabus_version_immutable", message: "Only draft syllabus versions can be edited." });
    return version;
  }
  private async editableForSubject(id: string) {
    const subject = await this.prisma.syllabusSubject.findUnique({ where: { id }, include: { paper: { include: { stage: true } } } });
    if (!subject) throw this.notFound("syllabus_subject_not_found", "The syllabus subject was not found.");
    await this.editable(subject.paper.stage.syllabusVersionId);
  }
  private async version(id: string) {
    const v = await this.prisma.syllabusVersion.findUnique({ where: { id }, include: { syllabus: true, ...tree } });
    if (!v) throw this.notFound("syllabus_version_not_found", "The syllabus version was not found.");
    return v;
  }
  private async topic(id: string) {
    const t = await this.prisma.syllabusTopic.findUnique({ where: { id } });
    if (!t) throw this.notFound("syllabus_topic_not_found", "The syllabus topic was not found.");
    return t;
  }
  private async cycle(id: string) {
    if (!(await this.prisma.examCycle.findUnique({ where: { id } })))
      throw this.notFound("exam_cycle_not_found", "The examination cycle was not found.");
  }
  private notFound(code: string, message: string) {
    return new NotFoundException({ code, message });
  }
}
