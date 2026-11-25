import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import type { InternalPrincipal } from "../auth/auth0.guard";
import type { AuditInput } from "../audit/audit.service";
import { PutConfigurationDto, UpdateConfigurationStatusDto } from "./configuration.dto";
import { PutFeatureFlagDto, UpdateFeatureFlagStatusDto } from "./feature-flag.dto";
import { configurationCatalogue } from "./configuration-catalogue";
import { PageQueryDto } from "../common/page-query.dto";
import { effectivePagination } from "../common/effective-pagination";

type RequestAudit = Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress">;

@Injectable()
/** Manages allowlisted application settings and registered feature flags (D4, D5, D6). */
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Platform Settings ───────────────────────────────────────────────────

  /** Lists settings of all statuses so administrators can reactivate inactive definitions (D4). */
  async listConfigurations(query: PageQueryDto) {
    const pagination = await effectivePagination(this.prisma, query);
    const where = {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.configuration.count({ where }),
      this.prisma.configuration.findMany({
        where,
        orderBy: [{ category: "asc" }, { configKey: "asc" }],
        skip: (pagination.page - 1) * pagination.page_size,
        take: pagination.page_size,
      }),
    ]);
    const data = items.map((item) => this.formatConfiguration(item));
    return { data, pagination: { ...pagination, total } };
  }

  /** Reads a setting definition by catalogue key, including inactive metadata (D4). */
  async getConfiguration(key: string) {
    if (!configurationCatalogue[key])
      throw new NotFoundException({ code: "configuration_not_found", message: "The approved configuration key was not found." });
    const item = await this.prisma.configuration.findUnique({ where: { configKey: key } });
    if (!item) throw new NotFoundException({ code: "configuration_not_found", message: "The approved configuration key was not found." });
    return { data: this.formatConfiguration(item) };
  }

  /** Formats a configuration record for API responses. Redacts value when is_sensitive = true (D4). */
  private formatConfiguration(item: {
    configKey: string;
    settingName: string;
    category: string;
    valueJson: unknown;
    valueType: string;
    description: string | null;
    isSensitive: boolean;
    isEditable: boolean;
    status: string;
    version: number;
    updatedAt: Date;
  }) {
    return {
      key: item.configKey,
      setting_name: item.settingName,
      category: item.category,
      // Redact the actual value for sensitive settings to prevent accidental secret exposure (D4, D6).
      value: item.isSensitive ? null : item.valueJson,
      value_redacted: item.isSensitive,
      value_type: item.valueType,
      description: item.description,
      is_sensitive: item.isSensitive,
      is_editable: item.isEditable,
      status: item.status,
      version: item.version,
      updated_at: item.updatedAt,
    };
  }

  /**
   * Validates and writes a catalogue setting with optimistic concurrency and transactional audit (D4, D6).
   *
   * Guards enforced:
   *  - Key must exist in the approved catalogue (allowlist).
   *  - is_editable = false → reject with 403 (D4).
   *  - status = INACTIVE → reject (INACTIVE settings are not evaluated).
   *  - Value must pass the catalogue's validator (D6).
   *  - expected_version must match current version (optimistic locking, D4).
   */
  async putConfiguration(actor: InternalPrincipal, key: string, dto: PutConfigurationDto, request: RequestAudit) {
    const rule = configurationCatalogue[key];
    if (!rule)
      throw new NotFoundException({
        code: "configuration_not_found",
        message: "The configuration key is not in the approved write allowlist.",
      });
    if (!rule.validate(dto.value))
      throw new BadRequestException({
        code: "invalid_configuration_value",
        message: "The value does not match the registered configuration schema.",
      });
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.configuration.findUnique({ where: { configKey: key } });

      // Enforce is_editable — back-end authority, not just UI hint (D4).
      if (previous && !previous.isEditable)
        throw new ForbiddenException({
          code: "configuration_not_editable",
          message: "This setting is marked non-editable and cannot be changed through the Admin API.",
        });

      // INACTIVE settings must not be updated (D4).
      if (previous && previous.status === "INACTIVE")
        throw new ConflictException({
          code: "configuration_inactive",
          message: "INACTIVE settings cannot be updated. Activate the setting first.",
        });

      // Cross-setting pagination guard.
      if (key === "pagination_default_page_size" || key === "pagination_max_page_size") {
        const counterpartKey = key === "pagination_default_page_size" ? "pagination_max_page_size" : "pagination_default_page_size";
        const counterpart = await tx.configuration.findUnique({
          where: { configKey: counterpartKey },
          select: { valueJson: true },
        });
        const defaultSize =
          key === "pagination_default_page_size"
            ? Number(dto.value)
            : Number(counterpart?.valueJson ?? configurationCatalogue.pagination_default_page_size.defaultValue);
        const maxSize =
          key === "pagination_max_page_size"
            ? Number(dto.value)
            : Number(counterpart?.valueJson ?? configurationCatalogue.pagination_max_page_size.defaultValue);
        if (defaultSize > maxSize)
          throw new BadRequestException({
            code: "invalid_pagination_configuration",
            message: "The default page size cannot exceed the maximum page size.",
          });
      }

      // Optimistic locking (D4 — version).
      if (previous && dto.expected_version !== previous.version)
        throw new ConflictException({
          code: "configuration_version_conflict",
          message: "expected_version must match the current configuration version.",
        });
      if (!previous && dto.expected_version !== undefined)
        throw new ConflictException({
          code: "configuration_version_conflict",
          message: "A new configuration key must omit expected_version.",
        });

      const item = previous
        ? await tx.configuration.update({
            where: { id: previous.id },
            data: {
              valueJson: dto.value as never,
              valueType: rule.type,
              settingName: rule.settingName,
              category: rule.category,
              description: rule.description,
              isSensitive: rule.isSensitive,
              isEditable: rule.isEditable,
              version: { increment: 1 },
              updatedBy: actor.id,
            },
          })
        : await tx.configuration.create({
            data: {
              configKey: key,
              settingName: rule.settingName,
              category: rule.category,
              valueJson: dto.value as never,
              valueType: rule.type,
              description: rule.description,
              isSensitive: rule.isSensitive,
              isEditable: rule.isEditable,
              status: "ACTIVE",
              updatedBy: actor.id,
            },
          });

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.CONFIGURATION_CHANGED,
          resourceType: "configuration",
          resourceId: item.id,
          ...request,
          result: "SUCCESS",
          metadata: {
            key,
            category: rule.category,
            is_sensitive: rule.isSensitive,
            previous_version: previous?.version ?? null,
            new_version: item.version,
            // Never persist the actual value in audit for sensitive settings (D4, D6).
            before_value: rule.isSensitive ? "[REDACTED]" : (previous?.valueJson ?? null),
            after_value: rule.isSensitive ? "[REDACTED]" : item.valueJson,
            ...(dto.reason ? { reason: dto.reason } : {}),
          },
        },
        tx,
      );

      return {
        data: {
          key,
          setting_name: item.settingName,
          category: item.category,
          value: item.isSensitive ? null : item.valueJson,
          value_redacted: item.isSensitive,
          value_type: item.valueType,
          is_sensitive: item.isSensitive,
          is_editable: item.isEditable,
          status: item.status,
          version: item.version,
          updated_at: item.updatedAt,
        },
      };
    });
  }

  /** Change setting availability with version checking and transactional audit. */
  async setConfigurationStatus(actor: InternalPrincipal, key: string, dto: UpdateConfigurationStatusDto, request: RequestAudit) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.configuration.findUnique({ where: { configKey: key } });
      if (!previous) throw new NotFoundException({ code: "configuration_not_found", message: "The configuration key was not found." });
      if (dto.expected_version !== previous.version)
        throw new ConflictException({
          code: "configuration_version_conflict",
          message: "expected_version must match the current configuration version.",
        });
      if (dto.status === previous.status) return { data: this.formatConfiguration(previous) };
      const updated = await tx.configuration.update({
        where: { id: previous.id },
        data: { status: dto.status, version: { increment: 1 }, updatedBy: actor.id },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.CONFIGURATION_CHANGED,
          resourceType: "configuration",
          resourceId: updated.id,
          ...request,
          result: "SUCCESS",
          metadata: {
            key,
            previous_status: previous.status,
            new_status: updated.status,
            previous_version: previous.version,
            new_version: updated.version,
            reason: dto.reason,
          },
        },
        tx,
      );
      return { data: this.formatConfiguration(updated) };
    });
  }

  // ─── Feature Flags ───────────────────────────────────────────────────────

  /** Lists all feature flags. INACTIVE flags show enabled=false regardless of their stored value (D5). */
  async flags(query: PageQueryDto) {
    const pagination = await effectivePagination(this.prisma, query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.featureFlag.count(),
      this.prisma.featureFlag.findMany({
        orderBy: [{ flagKey: "asc" }],
        skip: (pagination.page - 1) * pagination.page_size,
        take: pagination.page_size,
      }),
    ]);
    return {
      data: data.map((flag) => this.formatFeatureFlag(flag)),
      pagination: { ...pagination, total },
    };
  }

  /** Reads one registered feature flag. INACTIVE flags report effective_enabled = false (D5). */
  async getFlag(key: string) {
    const item = await this.prisma.featureFlag.findUnique({ where: { flagKey: key } });
    if (!item) throw new NotFoundException({ code: "feature_flag_not_found", message: "The feature flag was not found." });
    return { data: this.formatFeatureFlag(item) };
  }

  /**
   * Formats a feature flag for API responses.
   * An INACTIVE flag always reports effective_enabled = false regardless of the stored `enabled`
   * field. This prevents a race where a flag is deactivated but its enabled=true is still served (D5).
   */
  private formatFeatureFlag(flag: {
    id: string;
    flagKey: string;
    name: string;
    enabled: boolean;
    status: string;
    version: number;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: flag.id,
      flag_key: flag.flagKey,
      name: flag.name,
      enabled: flag.enabled,
      // effective_enabled = false when status is INACTIVE, regardless of `enabled` (D5).
      effective_enabled: flag.status === "ACTIVE" && flag.enabled,
      status: flag.status,
      version: flag.version,
      description: flag.description,
      created_at: flag.createdAt,
      updated_at: flag.updatedAt,
    };
  }

  /**
   * Updates a registered feature flag with optimistic concurrency and transactional audit (D5).
   *
   * Guards enforced:
   *  - Flag must exist (unknown keys rejected).
   *  - status = INACTIVE → reject update (INACTIVE flags must not be toggled; activate first).
   *  - expected_version must match current version when supplied (D5 — optimistic locking).
   */
  async putFlag(actor: InternalPrincipal, key: string, dto: PutFeatureFlagDto, request: RequestAudit) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.featureFlag.findUnique({ where: { flagKey: key } });
      if (!previous)
        throw new NotFoundException({ code: "feature_flag_not_found", message: "Only registered feature flags may be updated." });

      // INACTIVE flags must not be toggled — the flag definition is deactivated (D5).
      if (previous.status === "INACTIVE")
        throw new ConflictException({
          code: "feature_flag_inactive",
          message:
            "This feature flag is INACTIVE and cannot be toggled. " + "A SUPER_ADMIN must reactivate it before changing its enabled state.",
        });

      if (dto.expected_version !== previous.version)
        throw new ConflictException({
          code: "feature_flag_version_conflict",
          message: "expected_version must match the current feature flag version.",
        });

      if (previous.enabled === dto.enabled) return { data: this.formatFeatureFlag({ ...previous, enabled: dto.enabled }) };

      const updated = await tx.featureFlag.update({
        where: { id: previous.id },
        data: { enabled: dto.enabled, version: { increment: 1 }, updatedBy: actor.id },
      });

      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.FEATURE_FLAG_CHANGED,
          resourceType: "feature_flag",
          resourceId: updated.id,
          ...request,
          result: "SUCCESS",
          metadata: {
            flag_key: key,
            previous_enabled: previous.enabled,
            new_enabled: updated.enabled,
            flag_status: updated.status,
            previous_version: previous.version,
            new_version: updated.version,
            reason: dto.reason,
          },
        },
        tx,
      );

      return { data: this.formatFeatureFlag(updated) };
    });
  }

  /** Change flag availability with version checking and transactional audit. */
  async setFeatureFlagStatus(actor: InternalPrincipal, key: string, dto: UpdateFeatureFlagStatusDto, request: RequestAudit) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.featureFlag.findUnique({ where: { flagKey: key } });
      if (!previous) throw new NotFoundException({ code: "feature_flag_not_found", message: "The feature flag was not found." });
      if (dto.expected_version !== previous.version)
        throw new ConflictException({
          code: "feature_flag_version_conflict",
          message: "expected_version must match the current feature flag version.",
        });
      if (dto.status === previous.status) return { data: this.formatFeatureFlag(previous) };
      const updated = await tx.featureFlag.update({
        where: { id: previous.id },
        data: { status: dto.status, version: { increment: 1 }, updatedBy: actor.id },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.FEATURE_FLAG_CHANGED,
          resourceType: "feature_flag",
          resourceId: updated.id,
          ...request,
          result: "SUCCESS",
          metadata: {
            flag_key: key,
            previous_status: previous.status,
            new_status: updated.status,
            previous_version: previous.version,
            new_version: updated.version,
            reason: dto.reason,
          },
        },
        tx,
      );
      return { data: this.formatFeatureFlag(updated) };
    });
  }
}
