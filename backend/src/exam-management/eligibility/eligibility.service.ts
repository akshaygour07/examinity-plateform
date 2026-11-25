import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../database/prisma.service";

type JsonRecord = Record<string, unknown>;
type InputDefinition = {
  inputKey: string;
  labelEn: string;
  inputType: string;
  isRequired: boolean;
  options: unknown;
  validationConfig: unknown;
};
type EligibilityRule = {
  id: string;
  inputKey: string | null;
  operator: string;
  comparisonValue: Prisma.JsonValue;
  failureMessageEn: string;
  isActive: boolean;
  priority: number;
};
type RuleGroup = { id: string; combinationOperator: string; priority: number; rules: EligibilityRule[] };

const supportedOperators = new Set([
  "EQUALS",
  "NOT_EQUALS",
  "IN",
  "NOT_IN",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "BETWEEN",
]);

@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async adminProfile(cycleId: string) {
    const item = await this.prisma.eligibilityProfile.findUnique({
      where: { examCycleId: cycleId },
      include: { versions: { include: { inputs: true, ruleGroups: { include: { rules: true } } }, orderBy: { versionNumber: "desc" } } },
    });
    if (!item)
      throw new NotFoundException({
        code: "eligibility_profile_not_found",
        message: "No eligibility profile was found for this examination cycle.",
      });
    return { data: item };
  }

  async publicConfig(cycleId: string) {
    const profile = await this.prisma.eligibilityProfile.findUnique({
      where: { examCycleId: cycleId, status: "ACTIVE" },
      include: {
        versions: { where: { publicationStatus: "PUBLISHED" }, include: { inputs: true }, orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });
    const version = profile?.versions[0];
    if (!profile || !version)
      throw new NotFoundException({
        code: "eligibility_not_found",
        message: "No published eligibility configuration was found for this examination cycle.",
      });
    return { data: { profile: { id: profile.id, name: profile.name, description: profile.description }, version } };
  }

  async create(cycleId: string, data: JsonRecord) {
    if (!(await this.prisma.examCycle.findUnique({ where: { id: cycleId } })))
      throw new NotFoundException({ code: "exam_cycle_not_found", message: "The examination cycle was not found." });
    return {
      data: await this.prisma.eligibilityProfile.create({
        data: {
          examCycleId: cycleId,
          name: typeof data.name === "string" ? data.name : "Eligibility",
          description: typeof data.description === "string" ? data.description : null,
        },
      }),
    };
  }

  async createVersion(profileId: string, data: JsonRecord) {
    const profile = await this.prisma.eligibilityProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new NotFoundException({ code: "eligibility_profile_not_found", message: "The eligibility profile was not found." });
    const count = await this.prisma.eligibilityVersion.count({ where: { eligibilityProfileId: profileId } });
    const referenceDate = data.referenceDate === undefined || data.referenceDate === null ? null : this.parseDate(data.referenceDate);
    return {
      data: await this.prisma.eligibilityVersion.create({
        data: {
          eligibilityProfileId: profileId,
          versionNumber: count + 1,
          referenceDate,
          nationalityRequired: data.nationalityRequired === true,
          qualificationRequired: data.qualificationRequired === true,
          sourceReferenceId: typeof data.sourceReferenceId === "string" ? data.sourceReferenceId : null,
        },
      }),
    };
  }

  async getVersion(id: string) {
    const data = await this.prisma.eligibilityVersion.findUnique({
      where: { id },
      include: {
        inputs: { orderBy: { displayOrder: "asc" } },
        ruleGroups: { include: { rules: { orderBy: { priority: "asc" } } }, orderBy: { priority: "asc" } },
      },
    });
    if (!data) throw new NotFoundException({ code: "eligibility_version_not_found", message: "The eligibility version was not found." });
    return { data };
  }

  async inputs(id: string, data: JsonRecord) {
    await this.draft(id);
    if (!Array.isArray(data.items)) throw this.invalid("items must be an array.");
    const items = data.items.map((item, index) => this.validateInput(item, index));
    await this.prisma.$transaction(async (tx) => {
      await tx.eligibilityInput.deleteMany({ where: { eligibilityVersionId: id } });
      if (items.length) await tx.eligibilityInput.createMany({ data: items.map((item) => ({ eligibilityVersionId: id, ...item })) });
    });
    return this.getVersion(id);
  }

  async rules(id: string, data: JsonRecord) {
    await this.draft(id);
    if (!Array.isArray(data.groups)) throw this.invalid("groups must be an array.");
    const inputs = await this.prisma.eligibilityInput.findMany({ where: { eligibilityVersionId: id }, select: { inputKey: true } });
    const inputKeys = new Set(inputs.map((item) => item.inputKey));
    const groups = data.groups.map((value, groupIndex) => {
      const group = this.record(value, `groups[${groupIndex}]`);
      const combinationOperator = group.combinationOperator ?? "AND";
      if (combinationOperator !== "AND" && combinationOperator !== "OR")
        throw this.invalid(`groups[${groupIndex}].combinationOperator must be AND or OR.`);
      if (!Array.isArray(group.rules) || group.rules.length === 0)
        throw this.invalid(`groups[${groupIndex}] must contain at least one rule.`);
      const rules = group.rules.map((value, ruleIndex) => {
        const rule = this.record(value, `groups[${groupIndex}].rules[${ruleIndex}]`);
        if (typeof rule.inputKey !== "string" || !inputKeys.has(rule.inputKey))
          throw this.invalid(`Rule inputKey must match a configured input.`);
        if (typeof rule.operator !== "string" || !supportedOperators.has(rule.operator))
          throw this.invalid(`Rule operator is not supported.`);
        if (rule.comparisonValue === undefined) throw this.invalid("Every rule requires comparisonValue.");
        if (typeof rule.failureMessageEn !== "string" || !rule.failureMessageEn.trim())
          throw this.invalid("Every rule requires failureMessageEn.");
        return {
          ruleType: typeof rule.ruleType === "string" ? rule.ruleType : "CUSTOM",
          inputKey: rule.inputKey,
          operator: rule.operator,
          comparisonValue: rule.comparisonValue as Prisma.InputJsonValue,
          priority: this.integer(rule.priority, 0),
          failureMessageEn: rule.failureMessageEn,
          failureMessageHi: typeof rule.failureMessageHi === "string" ? rule.failureMessageHi : null,
          isActive: rule.isActive !== false,
        };
      });
      return {
        combinationOperator,
        priority: this.integer(group.priority, groupIndex),
        description: typeof group.description === "string" ? group.description : null,
        rules,
      };
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.eligibilityRule.deleteMany({ where: { group: { eligibilityVersionId: id } } });
      await tx.eligibilityRuleGroup.deleteMany({ where: { eligibilityVersionId: id } });
      for (const group of groups)
        await tx.eligibilityRuleGroup.create({
          data: {
            eligibilityVersionId: id,
            combinationOperator: group.combinationOperator,
            priority: group.priority,
            description: group.description,
            rules: { create: group.rules },
          },
        });
    });
    return this.getVersion(id);
  }

  async validate(id: string) {
    const { data } = await this.getVersion(id);
    const issues: string[] = [];
    if (!data.sourceReferenceId) issues.push("An official source reference is required.");
    if (!data.referenceDate && data.inputs.some((input) => input.inputType === "DATE" && /birth|dob/i.test(input.inputKey)))
      issues.push("A reference date is required to evaluate age rules.");
    if (!data.inputs.length) issues.push("At least one learner input is required.");
    if (!data.ruleGroups.length) issues.push("At least one rule group is required.");
    for (const group of data.ruleGroups) {
      if (!group.rules.length) issues.push(`Rule group ${group.id} has no rules.`);
      for (const rule of group.rules) {
        if (!supportedOperators.has(rule.operator)) issues.push(`Rule ${rule.id} uses unsupported operator ${rule.operator}.`);
        if (rule.inputKey && !data.inputs.some((input) => input.inputKey === rule.inputKey))
          issues.push(`Rule ${rule.id} references an unconfigured input.`);
      }
    }
    return { data: { valid: issues.length === 0, issues } };
  }

  async check(cycleId: string, values: JsonRecord) {
    const profile = await this.prisma.eligibilityProfile.findUnique({
      where: { examCycleId: cycleId, status: "ACTIVE" },
      include: {
        versions: {
          where: { publicationStatus: "PUBLISHED" },
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: {
            inputs: { orderBy: { displayOrder: "asc" } },
            ruleGroups: { include: { rules: { where: { isActive: true }, orderBy: { priority: "asc" } } }, orderBy: { priority: "asc" } },
          },
        },
      },
    });
    const version = profile?.versions[0];
    if (!profile || !version)
      throw new NotFoundException({
        code: "eligibility_not_found",
        message: "No published eligibility configuration was found for this examination cycle.",
      });
    const definitions = version.inputs as InputDefinition[];
    const known = new Set(definitions.map((input) => input.inputKey));
    const unknown = Object.keys(values).filter((key) => !known.has(key));
    if (unknown.length) throw this.invalid("The request contains unknown eligibility input keys.", { keys: unknown });
    for (const input of definitions)
      if (Object.hasOwn(values, input.inputKey) && !this.matchesType(values[input.inputKey], input.inputType))
        throw this.invalid(`Input ${input.inputKey} has an invalid value type.`);

    const missing = definitions.filter(
      (input) =>
        input.isRequired && (values[input.inputKey] === undefined || values[input.inputKey] === null || values[input.inputKey] === ""),
    );
    const criteria: Array<{ code: string; status: "PASSED" | "FAILED" | "UNKNOWN"; message: string }> = missing.map((input) => ({
      code: input.inputKey,
      status: "UNKNOWN",
      message: `${input.labelEn} is required`,
    }));
    let failed = false;
    let unknownRule = !version.sourceReferenceId;
    if (!version.sourceReferenceId)
      criteria.push({ code: "OFFICIAL_SOURCE", status: "UNKNOWN", message: "An official eligibility source has not been linked." });
    for (const group of version.ruleGroups as RuleGroup[]) {
      const outcomes = group.rules
        .filter((rule) => rule.isActive)
        .map((rule) => {
          const input = definitions.find((definition) => definition.inputKey === rule.inputKey);
          const value = rule.inputKey ? values[rule.inputKey] : undefined;
          if (!rule.inputKey || value === undefined || value === null || !input) return { rule, result: null };
          return { rule, result: this.evaluate(value, rule.operator, rule.comparisonValue, input.inputType, version.referenceDate) };
        });
      if (!outcomes.length) {
        unknownRule = true;
        continue;
      }
      const results = outcomes.map((outcome) => outcome.result);
      const groupResult =
        group.combinationOperator === "OR"
          ? results.includes(true)
            ? true
            : results.includes(null)
              ? null
              : false
          : results.includes(false)
            ? false
            : results.includes(null)
              ? null
              : true;
      if (groupResult === null) unknownRule = true;
      if (groupResult === false) failed = true;
      criteria.push(
        ...outcomes.map(({ rule, result }) => ({
          code: rule.inputKey ?? rule.id,
          status: result === null ? ("UNKNOWN" as const) : result ? ("PASSED" as const) : ("FAILED" as const),
          message: result
            ? `${rule.inputKey} criteria satisfied`
            : result === null
              ? "This criterion could not be evaluated with the supplied information."
              : rule.failureMessageEn,
        })),
      );
    }
    const status = failed
      ? "APPEARS_NOT_ELIGIBLE"
      : missing.length || unknownRule
        ? "CANNOT_DETERMINE"
        : criteria.length
          ? "APPEARS_ELIGIBLE"
          : "CANNOT_DETERMINE";
    return {
      data: {
        status,
        evaluationDate: version.referenceDate,
        ruleVersion: version.versionNumber,
        criteria,
        disclaimer: "This is an indicative evaluation. Refer to the official notification.",
      },
    };
  }

  private async draft(id: string) {
    const version = await this.prisma.eligibilityVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException({ code: "eligibility_version_not_found", message: "The eligibility version was not found." });
    if (version.publicationStatus !== "DRAFT")
      throw new NotFoundException({ code: "eligibility_version_immutable", message: "Only draft eligibility versions can be edited." });
  }
  private validateInput(value: unknown, index: number) {
    const item = this.record(value, `items[${index}]`);
    if (typeof item.inputKey !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(item.inputKey))
      throw this.invalid(`items[${index}].inputKey is invalid.`);
    if (typeof item.labelEn !== "string" || !item.labelEn.trim()) throw this.invalid(`items[${index}].labelEn is required.`);
    if (typeof item.inputType !== "string" || !["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT"].includes(item.inputType))
      throw this.invalid(`items[${index}].inputType is unsupported.`);
    return {
      inputKey: item.inputKey,
      labelEn: item.labelEn.trim(),
      labelHi: typeof item.labelHi === "string" ? item.labelHi : null,
      inputType: item.inputType,
      isRequired: item.isRequired === true,
      options: item.options === undefined ? Prisma.JsonNull : (item.options as Prisma.InputJsonValue),
      displayOrder: this.integer(item.displayOrder, index),
      validationConfig: item.validationConfig === undefined ? Prisma.DbNull : (item.validationConfig as Prisma.InputJsonValue),
    };
  }
  private evaluate(
    value: unknown,
    operator: string,
    expected: Prisma.JsonValue,
    inputType: string,
    referenceDate: Date | null,
  ): boolean | null {
    if (
      inputType === "DATE" &&
      operator === "BETWEEN" &&
      referenceDate &&
      this.isRecord(expected) &&
      typeof expected.minAge === "number" &&
      typeof expected.maxAge === "number"
    ) {
      const age = this.age(value, referenceDate);
      return age === null ? null : age >= expected.minAge && age <= expected.maxAge;
    }
    if (operator === "EQUALS") return value === expected;
    if (operator === "NOT_EQUALS") return value !== expected;
    if (operator === "IN" || operator === "NOT_IN") {
      if (!Array.isArray(expected)) return null;
      const included = expected.some((entry) => entry === value);
      return operator === "IN" ? included : !included;
    }
    if (["GREATER_THAN", "GREATER_THAN_OR_EQUAL", "LESS_THAN", "LESS_THAN_OR_EQUAL", "BETWEEN"].includes(operator)) {
      const actual = inputType === "DATE" && typeof value === "string" ? Date.parse(value) : typeof value === "number" ? value : Number.NaN;
      if (!Number.isFinite(actual)) return null;
      if (operator === "BETWEEN" && Array.isArray(expected) && expected.length === 2 && expected.every((item) => typeof item === "number"))
        return actual >= expected[0] && actual <= expected[1];
      if (typeof expected !== "number") return null;
      if (operator === "GREATER_THAN") return actual > expected;
      if (operator === "GREATER_THAN_OR_EQUAL") return actual >= expected;
      if (operator === "LESS_THAN") return actual < expected;
      return actual <= expected;
    }
    return null;
  }
  private age(value: unknown, referenceDate: Date): number | null {
    if (typeof value !== "string") return null;
    const dob = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(dob.getTime()) || dob > referenceDate) return null;
    let years = referenceDate.getUTCFullYear() - dob.getUTCFullYear();
    if (
      referenceDate.getUTCMonth() < dob.getUTCMonth() ||
      (referenceDate.getUTCMonth() === dob.getUTCMonth() && referenceDate.getUTCDate() < dob.getUTCDate())
    )
      years -= 1;
    return years;
  }
  private matchesType(value: unknown, type: string) {
    return type === "TEXT" || type === "SELECT"
      ? typeof value === "string"
      : type === "NUMBER"
        ? typeof value === "number" && Number.isFinite(value)
        : type === "BOOLEAN"
          ? typeof value === "boolean"
          : type === "DATE"
            ? typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
            : type === "MULTI_SELECT"
              ? Array.isArray(value) && value.every((item) => typeof item === "string")
              : false;
  }
  private parseDate(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)))
      throw this.invalid("referenceDate must be a valid YYYY-MM-DD date.");
    return new Date(`${value}T00:00:00.000Z`);
  }
  private integer(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isInteger(value) ? value : fallback;
  }
  private record(value: unknown, field: string): JsonRecord {
    if (!this.isRecord(value)) throw this.invalid(`${field} must be an object.`);
    return value;
  }
  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  private invalid(message: string, details?: object) {
    return new UnprocessableEntityException({ code: "eligibility_input_invalid", message, ...(details ? { details } : {}) });
  }
}
