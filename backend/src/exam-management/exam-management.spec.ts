/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic Prisma delegate mocks use intentionally loose call signatures. */
import assert from "node:assert/strict";
import { jest } from "@jest/globals";
import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { ExamsService } from "./exams/exams.service";
import { OverviewService } from "./overview/overview.service";
import { EligibilityService } from "./eligibility/eligibility.service";
import { ExamPatternService } from "./exam-pattern/exam-pattern.service";
import { SyllabusService } from "./syllabus/syllabus.service";
import { EventsService } from "./events/events.service";
import { SelectionProcessService } from "./selection-process/selection-process.service";
import { SalaryService } from "./salary/salary.service";
import { AnalysisService } from "./analysis/analysis.service";
import { CutoffsService } from "./cutoffs/cutoffs.service";
import { DocumentsService } from "./documents/documents.service";
import { ImportsService } from "./imports/imports.service";

const actor = {
  id: "user-1",
  subject: "auth0|user-1",
  claims: { sub: "auth0|user-1" },
  status: "ACTIVE",
  roles: ["SUPER_ADMIN"],
  permissions: [],
};
const mock = <T extends object>(value: T) => value as never;

describe("Module 2 exam management services", () => {
  describe("ExamsService", () => {
    test("normalizes and creates taxonomy, then records an audit event", async () => {
      const create = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "cat-1", name: "Banking", slug: "banking" });
      const record = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined);
      const service = new ExamsService(mock({ examCategory: { create } }), mock({ record }));

      const result = await service.createTaxonomy("category", { name: " Banking ", slug: " BANKING " } as never, actor as never);

      assert.deepEqual(result.data, { id: "cat-1", name: "Banking", slug: "banking" });
      assert.equal(create.mock.calls[0][0].data.name, "Banking");
      assert.equal(create.mock.calls[0][0].data.slug, "banking");
      assert.equal(record.mock.calls[0][0].action, "EXAM_CATEGORY_CREATED");
    });

    test("maps duplicate taxonomy keys to a conflict", async () => {
      const service = new ExamsService(
        mock({ examCategory: { create: jest.fn<(...args: any[]) => Promise<any>>().mockRejectedValue({ code: "P2002" }) } }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );
      await assert.rejects(
        () => service.createTaxonomy("category", { name: "Banking", slug: "banking" } as never, actor as never),
        ConflictException,
      );
    });

    test("requires active referenced records and rejects a primary state outside state_ids", async () => {
      const count = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(0);
      const service = new ExamsService(
        mock({ examBody: { count }, examCategory: { count }, examGroup: { count }, state: { count } }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );
      await assert.rejects(
        () => service.createExam({ exam_body_id: "missing", category_ids: ["cat-1"], exam_scope: "NATIONAL" } as never, actor as never),
        NotFoundException,
      );
      const goodReferences = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(1);
      const primaryMismatch = new ExamsService(
        mock({
          examBody: { count: goodReferences },
          examCategory: { count: goodReferences },
          examGroup: { count: goodReferences },
          state: { count: goodReferences },
        }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );
      await assert.rejects(
        () =>
          primaryMismatch.createExam(
            {
              exam_body_id: "body-1",
              category_ids: ["cat-1"],
              state_ids: [],
              primary_state_id: "state-1",
              exam_scope: "NATIONAL",
            } as never,
            actor as never,
          ),
        ConflictException,
      );
    });

    test("applies public filters, ordering and bounded pagination", async () => {
      const count = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(0);
      const findMany = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
      const service = new ExamsService(
        mock({ exam: { count, findMany }, $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations) }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );

      const result = await service.listExams({ q: " bank ", category_id: "cat-1", page: 3, limit: 500 } as never, true);

      assert.deepEqual(result.pagination, { page: 3, limit: 100, total: 0 });
      assert.deepEqual(findMany.mock.calls[0][0].where, {
        status: "ACTIVE",
        archivedAt: null,
        categoryMappings: { some: { categoryId: "cat-1" } },
        OR: [
          { name: { contains: " bank ", mode: "insensitive" } },
          { shortName: { contains: " bank ", mode: "insensitive" } },
          { aliases: { some: { normalizedAlias: { contains: "bank" } } } },
        ],
      });
      assert.equal(findMany.mock.calls[0][0].skip, 200);
    });

    test("requires expected_version on exam updates and hides non-public exam detail", async () => {
      const findUnique = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "exam-1", version: 4 });
      const findFirst = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null);
      const service = new ExamsService(
        mock({ exam: { findUnique, findFirst } }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );
      const dto = { exam_body_id: "body-1", category_ids: [], exam_scope: "NATIONAL" };
      await assert.rejects(() => service.updateExam("exam-1", dto as never, actor as never), ConflictException);
      await assert.rejects(() => service.getExam("hidden-slug", true), NotFoundException);
      assert.deepEqual(findFirst.mock.calls[0][0].where, { slug: "hidden-slug", status: "ACTIVE", archivedAt: null });
    });

    test("rejects duplicate aliases and prevents deleting another examination's alias", async () => {
      const exam = { findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "exam-1", status: "ACTIVE" }) };
      const alias = {
        create: jest.fn<(...args: any[]) => Promise<any>>().mockRejectedValue({ code: "P2002" }),
        delete: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "alias-1", examId: "other-exam" }),
      };
      const service = new ExamsService(mock({ exam, examAlias: alias }), mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }));
      await assert.rejects(() => service.addAlias("exam-1", { alias: "same" } as never, actor as never), ConflictException);
      await assert.rejects(() => service.removeAlias("exam-1", "alias-1", actor as never), NotFoundException);
    });

    test("rejects stale cycle versions and filters public cycles to published records", async () => {
      const findUnique = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "cycle-1", version: 3 });
      const cycleFindMany = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
      const examFindFirst = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "exam-1", slug: "exam", status: "ACTIVE" });
      const service = new ExamsService(
        mock({ examCycle: { findUnique, findMany: cycleFindMany }, exam: { findFirst: examFindFirst } }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );
      await assert.rejects(
        () =>
          service.updateCycle(
            "cycle-1",
            { expected_version: 2, cycle_year: 2027, cycle_code: "A", cycle_label: "A" } as never,
            actor as never,
          ),
        ConflictException,
      );
      await service.cycles("exam-1", true);
      assert.deepEqual(cycleFindMany.mock.calls[0][0].where, { examId: "exam-1", publicationStatus: "PUBLISHED", archivedAt: null });
    });

    test("returns a valid XLSX export buffer for an existing exam", async () => {
      const exam = {
        id: "exam-1",
        name: "Exam",
        slug: "exam",
        status: "ACTIVE",
        body: { name: "Authority" },
        examScope: "NATIONAL",
        examMode: "ONLINE",
        cycles: [],
      };
      const service = new ExamsService(
        mock({ exam: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(exam) } }),
        mock({ record: jest.fn<(...args: any[]) => Promise<any>>() }),
      );
      const buffer = await service.exportWorkbook("exam-1");
      assert.ok(Buffer.isBuffer(buffer));
      assert.ok(buffer.length > 0);
    });
  });

  describe("OverviewService", () => {
    test("creates then updates the latest draft and rejects a missing published overview", async () => {
      const draft = { id: "overview-1", publicationStatus: "DRAFT" };
      const findFirst = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValueOnce(null).mockResolvedValueOnce(draft);
      const create = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "overview-new" });
      const update = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "overview-1", description: "updated" });
      const service = new OverviewService(
        mock({
          examCycle: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "cycle-1" }) },
          examOverviewVersion: { findFirst, count: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(0), create, update },
        }),
      );
      await service.saveDraft("cycle-1", { description: "first" } as never);
      await service.saveDraft("cycle-1", { description: "updated" } as never);
      assert.equal(create.mock.calls[0][0].data.versionNumber, 1);
      assert.equal(update.mock.calls[0][0].where.id, "overview-1");
      await assert.rejects(() => service.publicOverview("cycle-1"), NotFoundException);
    });
  });

  describe("EligibilityService", () => {
    test("reports missing profiles and hides unpublished public configuration", async () => {
      const findUnique = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValueOnce(null).mockResolvedValueOnce({ versions: [] });
      const service = new EligibilityService(mock({ eligibilityProfile: { findUnique } }));
      await assert.rejects(() => service.adminProfile("cycle-1"), NotFoundException);
      await assert.rejects(() => service.publicConfig("cycle-1"), NotFoundException);
    });

    test("validates required inputs/rules and returns missing required criteria", async () => {
      const getVersion = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        data: {
          sourceReferenceId: "source-1",
          referenceDate: new Date("2027-01-01"),
          inputs: [{ inputKey: "age", inputType: "NUMBER", isRequired: true, labelEn: "Age" }],
          ruleGroups: [
            {
              id: "group-1",
              rules: [{ id: "rule-1", inputKey: "age", operator: "GREATER_THAN_OR_EQUAL", comparisonValue: 18, isActive: true }],
            },
          ],
        },
      });
      const findUnique = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        versions: [
          {
            versionNumber: 1,
            referenceDate: new Date("2027-01-01"),
            inputs: [{ inputKey: "age", inputType: "NUMBER", isRequired: true, labelEn: "Age" }],
            ruleGroups: [
              {
                id: "group-1",
                combinationOperator: "AND",
                rules: [
                  {
                    id: "rule-1",
                    inputKey: "age",
                    operator: "GREATER_THAN_OR_EQUAL",
                    comparisonValue: 18,
                    failureMessageEn: "Must be at least 18",
                    isActive: true,
                  },
                ],
              },
            ],
          },
        ],
      });
      const service = new EligibilityService(mock({ eligibilityProfile: { findUnique } }));
      Object.assign(service, { getVersion });
      assert.deepEqual((await service.validate("version-1")).data, { valid: true, issues: [] });
      const checked = await service.check("cycle-1", {});
      assert.equal(checked.data.status, "CANNOT_DETERMINE");
      assert.equal(checked.data.criteria[0].code, "age");
    });

    test("evaluates published rules and rejects unknown learner inputs", async () => {
      const findUnique = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
        versions: [
          {
            versionNumber: 3,
            sourceReferenceId: "source-1",
            referenceDate: new Date("2027-01-01"),
            inputs: [{ inputKey: "age", inputType: "NUMBER", isRequired: true, labelEn: "Age" }],
            ruleGroups: [
              {
                combinationOperator: "AND",
                rules: [
                  {
                    id: "age-rule",
                    inputKey: "age",
                    operator: "BETWEEN",
                    comparisonValue: [18, 32],
                    failureMessageEn: "Age must be 18 to 32",
                    isActive: true,
                  },
                ],
              },
            ],
          },
        ],
      });
      const service = new EligibilityService(mock({ eligibilityProfile: { findUnique } }));

      await assert.rejects(() => service.check("cycle-1", { age: 20, unconfigured: true }), UnprocessableEntityException);
      assert.equal((await service.check("cycle-1", { age: 20 })).data.status, "APPEARS_ELIGIBLE");
      const ineligible = await service.check("cycle-1", { age: 40 });
      assert.equal(ineligible.data.status, "APPEARS_NOT_ELIGIBLE");
      assert.equal(ineligible.data.criteria[0].status, "FAILED");
    });

    test("does not edit published versions", async () => {
      const service = new EligibilityService(
        mock({
          eligibilityVersion: {
            findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ publicationStatus: "PUBLISHED" }),
          },
        }),
      );
      await assert.rejects(() => service.inputs("version-1", { items: [] }), NotFoundException);
    });
  });

  describe("ExamPatternService", () => {
    test("validates an empty pattern and blocks edits after publication", async () => {
      const service = new ExamPatternService(
        mock({
          examPatternVersion: {
            findUnique: jest
              .fn<(...args: any[]) => Promise<any>>()
              .mockResolvedValue({ id: "pattern-1", publicationStatus: "PUBLISHED", stages: [] }),
          },
        }),
      );
      assert.deepEqual((await service.validate("pattern-1")).data, {
        valid: false,
        issues: ["An official source reference is required.", "At least one examination stage is required."],
      });
      await assert.rejects(() => service.stage("pattern-1", { name: "Stage", stageType: "WRITTEN", sequence: 1 }), ConflictException);
    });

    test("rejects invalid stage values before writing", async () => {
      const create = jest.fn<(...args: any[]) => Promise<any>>();
      const service = new ExamPatternService(
        mock({
          examPatternVersion: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ publicationStatus: "DRAFT" }) },
          examStage: { create },
        }),
      );
      await assert.rejects(
        () => service.stage("pattern-1", { name: "Written", stageType: "WRITTEN", sequence: 0 }),
        UnprocessableEntityException,
      );
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("SyllabusService", () => {
    test("reports hierarchy gaps and prevents publishing incomplete syllabus", async () => {
      const version = { id: "version-1", publicationStatus: "DRAFT", stages: [{ name: "Stage 1", papers: [] }] };
      const service = new SyllabusService(
        mock({ syllabusVersion: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(version) } }),
      );
      const result = await service.validate("version-1");
      assert.equal(result.data.valid, false);
      assert.ok(result.data.issues.some((issue: string) => /no paper/i.test(issue)));
      await assert.rejects(() => service.publish("version-1"), UnprocessableEntityException);
    });

    test("rejects self-parenting topics and duplicate topic codes", async () => {
      const service = new SyllabusService(
        mock({
          syllabusSubject: {
            findUnique: jest
              .fn<(...args: any[]) => Promise<any>>()
              .mockResolvedValue({ id: "subject-1", paper: { stage: { syllabusVersionId: "version-1" } } }),
          },
          syllabusVersion: {
            findUnique: jest
              .fn<(...args: any[]) => Promise<any>>()
              .mockResolvedValue({ id: "version-1", publicationStatus: "DRAFT", stages: [] }),
          },
          syllabusTopic: {
            findUnique: jest
              .fn<(...args: any[]) => Promise<any>>()
              .mockResolvedValue({ id: "topic-1", syllabusSubjectId: "subject-1", parentTopicId: null, depthLevel: 1 }),
            findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "other-topic" }),
          },
        }),
      );
      await assert.rejects(
        () => service.updateTopic("topic-1", { parentTopicId: "topic-1" } as never),
        (error: unknown) => error instanceof UnprocessableEntityException,
      );
      await assert.rejects(
        () => service.addTopic("subject-1", { name: "Topic", displayOrder: 1, topicCode: "DUP" } as never),
        ConflictException,
      );
    });
  });

  describe("EventsService", () => {
    test("rejects end dates before start dates", async () => {
      const service = new EventsService(mock({ examEvent: { create: jest.fn<(...args: any[]) => Promise<any>>() } }));
      await assert.rejects(
        () => service.create("cycle-1", { eventType: "APPLICATION", title: "Apply", startAt: "2027-02-02", endAt: "2027-01-01" } as never),
        BadRequestException,
      );
    });

    test("revises events transactionally and records the next revision number", async () => {
      const current = {
        id: "event-1",
        startAt: new Date("2027-01-01"),
        endAt: new Date("2027-02-01"),
        publishedAt: new Date("2026-12-01"),
        sourceReferenceId: "source-1",
      };
      const revisionCreate = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ revisionNumber: 2 });
      const tx = {
        examEventRevision: { count: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(1), create: revisionCreate },
        examEvent: { update: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(current) },
      };
      const service = new EventsService(
        mock({
          examEvent: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(current) },
          $transaction: async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx),
        }),
      );
      const result = await service.revise("event-1", { revisionReason: "Changed schedule", sourceReferenceId: "source-1" } as never);
      assert.equal(result.data.revisionNumber, 2);
      assert.equal(revisionCreate.mock.calls[0][0].data.revisionReason, "Changed schedule");
      assert.equal(revisionCreate.mock.calls[0][0].data.revisionStatus, "PENDING_REVIEW");
      expect(tx.examEvent.update).not.toHaveBeenCalled();
    });

    test("applies event revision only after review and verification, then writes an audit record", async () => {
      const revision = {
        id: "revision-1",
        examEventId: "event-1",
        revisionStatus: "VERIFIED",
        requestedEventStatus: null,
        newStartAt: new Date("2027-02-01"),
        newEndAt: new Date("2027-03-01"),
        event: {},
      };
      const updateEvent = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "event-1", publishedAt: new Date() });
      const tx = {
        examEventRevision: {
          count: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(0),
          updateMany: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ count: 1 }),
        },
        examEvent: { update: updateEvent },
      };
      const record = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({});
      const service = new EventsService(
        mock({
          examEventRevision: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(revision) },
          $transaction: async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx),
        }),
        mock({ record }),
      );
      await service.transitionRevision("revision-1", "publish", "admin-1", { requestId: "request-1" });
      assert.equal(updateEvent.mock.calls[0][0].data.startAt.toISOString(), "2027-02-01T00:00:00.000Z");
      assert.equal(record.mock.calls[0][0].actorUserId, "admin-1");
    });
  });

  describe("SelectionProcessService", () => {
    test("numbers new versions and defaults new stages to mandatory", async () => {
      const createVersion = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ versionNumber: 2 });
      const createStage = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ isMandatory: true });
      const service = new SelectionProcessService(
        mock({
          selectionProcessVersion: { count: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(1), create: createVersion },
          selectionStage: { create: createStage },
        }),
      );
      const version = await service.create("cycle-1", {} as never);
      const stage = await service.addStage("version-1", { name: "Interview", sequence: 1, stageType: "INTERVIEW" } as never);
      assert.equal(version.data.versionNumber, 2);
      assert.equal(stage.data.isMandatory, true);
    });

    test("hides a missing public selection process", async () => {
      const service = new SelectionProcessService(
        mock({ selectionProcessVersion: { findFirst: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null) } }),
      );
      await assert.rejects(() => service.list("cycle-1", true), NotFoundException);
    });
  });

  describe("SalaryService, AnalysisService and CutoffsService", () => {
    test("creates salary records with normalized optional dates", async () => {
      const create = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "salary-1" });
      const service = new SalaryService(mock({ salaryRecord: { create } }));
      await service.create("cycle-1", { postName: "Officer", effectiveFrom: "2027-01-01" } as never);
      assert.equal(create.mock.calls[0][0].data.examCycleId, "cycle-1");
      assert.equal(create.mock.calls[0][0].data.effectiveFrom.toISOString(), "2027-01-01T00:00:00.000Z");
    });

    test("defaults analysis publication and verification states", async () => {
      const create = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "analysis-1" });
      const service = new AnalysisService(mock({ examAnalysisRecord: { create } }));
      await service.create("cycle-1", { analysisYear: 2027, analysisType: "TREND", title: "Trend", data: {} } as never);
      assert.equal(create.mock.calls[0][0].data.verificationStatus, "UNVERIFIED");
      assert.equal(create.mock.calls[0][0].data.publicationStatus, "DRAFT");
    });

    test("returns cutoff data scoped to the requested cycle", async () => {
      const findMany = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
      const service = new CutoffsService(mock({ cutoffRecord: { findMany } }));
      await service.list("cycle-1");
      assert.deepEqual(findMany.mock.calls[0][0].where, { examCycleId: "cycle-1" });
    });
  });

  describe("DocumentsService", () => {
    test("validates required document, link and FAQ fields before persistence", async () => {
      const service = new DocumentsService(
        mock({
          exam: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "exam-1" }) },
          examDocument: { create: jest.fn<(...args: any[]) => Promise<any>>() },
          examLink: { create: jest.fn<(...args: any[]) => Promise<any>>() },
          examFaq: { create: jest.fn<(...args: any[]) => Promise<any>>() },
        }),
      );
      await assert.rejects(() => service.create("document", "exam-1", {}), BadRequestException);
      await assert.rejects(() => service.create("link", "exam-1", { title: "Official" }), BadRequestException);
      await assert.rejects(() => service.create("faq", "exam-1", { question: "Q" }), BadRequestException);
    });

    test("returns only public-ready documents", async () => {
      const findMany = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
      const service = new DocumentsService(
        mock({
          exam: { findUnique: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "exam-1" }) },
          examDocument: { findMany },
        }),
      );
      await service.list("document", "exam-1", true);
      assert.deepEqual(findMany.mock.calls[0][0].where, { examId: "exam-1", status: "ACTIVE", verificationStatus: "VERIFIED" });
    });
  });

  describe("ImportsService", () => {
    test("returns only pending/validated jobs in the publishing queue", async () => {
      const findMany = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);
      const service = new ImportsService(mock({ examImportJob: { findMany } }));
      await service.queue();
      assert.deepEqual(findMany.mock.calls[0][0].where.status.in, ["PENDING", "VALIDATED"]);
    });

    test("commits an import once and rejects a second commit", async () => {
      const findUnique = jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValueOnce({ id: "job-1", status: "VALIDATED", totalRows: 1, validRows: 1, invalidRows: 0 })
        .mockResolvedValueOnce({ id: "job-1", status: "COMMITTED" });
      const updateMany = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ count: 1 });
      const tx = {
        examImportRow: { count: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(0) },
        examImportJob: {
          updateMany,
          findUniqueOrThrow: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ id: "job-1", status: "COMMITTED" }),
        },
      };
      const service = new ImportsService(
        mock({
          examImportJob: { findUnique },
          $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
        }),
      );
      await service.commit("job-1");
      assert.equal(updateMany.mock.calls[0][0].data.status, "COMMITTED");
      await assert.rejects(() => service.commit("job-1"), ConflictException);
    });

    test("rejects unknown publishing actions", async () => {
      const service = new ImportsService(mock({}));
      await assert.rejects(() => service.action("content-1", "approve"), NotFoundException);
    });
  });
});
