import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import type { InternalPrincipal } from "../auth/auth0.guard";
import type { AuditInput } from "../audit/audit.service";
import { ListUsersDto } from "./list-users.dto";
import { UpdateUserDto } from "./update-user.dto";
import { UpdatePreferencesDto } from "./update-preferences.dto";
import { AssignRoleDto, RevokeRoleDto } from "./assign-role.dto";
import { ApproveReinstatementDto, RejectReinstatementDto, ReinstateUserDto } from "./reinstate-user.dto";
import { UnlockUserDto } from "./unlock-user.dto";
import { LockUserDto, UpdateUserStatusDto } from "./update-user-status.dto";
import { EmailService } from "../notifications/email.service";
import { effectivePagination } from "../common/effective-pagination";

type RequestAudit = Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress">;

@Injectable()
/** Implements user self-service and permission-checked administration with transactional audit records. */
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  /**
   * Returns a paginated list of users matching the supplied filter criteria.
   *
   * The `AuthorizationGuard` resolves the authenticated principal. This
   * service enforces `admin.users.view` directly before reading user records.
   *
   * Response field naming follows the Admin Module screen specification:
   * `phone_e164` for the E.164-formatted number and `phone_verified` for its
   * verification status — consistent with `get()`, `auth/me`, and dashboard.
   */
  async list(actor: InternalPrincipal, query: ListUsersDto) {
    if (!actor.permissions.includes("admin.users.view"))
      throw new ForbiddenException({ code: "insufficient_permission", message: "You do not have permission to perform this action." });
    if (query.created_from && query.created_to && new Date(query.created_to) < new Date(query.created_from))
      throw new ConflictException({ code: "invalid_user_date_range", message: "created_to must be on or after created_from." });
    const pagination = await effectivePagination(this.prisma, query);
    const now = new Date();
    const searchConditions: Prisma.UserWhereInput[] = [];
    if (query.search)
      searchConditions.push({
        OR: [
          { emailNormalized: { contains: query.search.toLowerCase(), mode: "insensitive" } },
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { phoneE164: { contains: query.search } },
        ],
      });
    if (query.name)
      searchConditions.push({
        OR: [{ firstName: { contains: query.name, mode: "insensitive" } }, { lastName: { contains: query.name, mode: "insensitive" } }],
      });
    if (query.email) searchConditions.push({ emailNormalized: { contains: query.email.toLowerCase(), mode: "insensitive" } });

    const where: Prisma.UserWhereInput = {
      ...(query.user_id ? { id: query.user_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.email_verified !== undefined ? { emailVerified: query.email_verified } : {}),
      // `mobile_verified` is the query-parameter name used in the Admin Module screen spec (ADM-003).
      // Internally it maps to the `phone_verified` boolean column via the `phoneVerified` Prisma field.
      ...(query.mobile_verified !== undefined ? { phoneVerified: query.mobile_verified } : {}),
      ...(query.mobile_number ? { phoneE164: { contains: query.mobile_number } } : {}),
      ...(query.role_code
        ? {
            assignments: {
              some: {
                status: "ACTIVE",
                role: { active: true, code: query.role_code },
                AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
              },
            },
          }
        : {}),
      ...(query.created_from || query.created_to
        ? {
            createdAt: {
              ...(query.created_from ? { gte: new Date(query.created_from) } : {}),
              ...(query.created_to ? { lte: new Date(query.created_to) } : {}),
            },
          }
        : {}),
      ...(searchConditions.length ? { AND: searchConditions } : {}),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (pagination.page - 1) * pagination.page_size,
        take: pagination.page_size,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneE164: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          assignments: { where: { status: "ACTIVE" }, include: { role: true } },
        },
      }),
    ]);
    return {
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        // `phone_e164` is the canonical field name used across all user responses
        // (get, auth/me, dashboard).  The Admin Module query parameter `mobile_number`
        // is an input alias only; responses always use `phone_e164`.
        phone_e164: user.phoneE164,
        status: user.status,
        email_verified: user.emailVerified,
        phone_verified: user.phoneVerified,
        roles: user.assignments
          .filter(
            (assignment) =>
              assignment.role.active &&
              (!assignment.startsAt || assignment.startsAt <= now) &&
              (!assignment.endsAt || assignment.endsAt > now),
          )
          .map((assignment) => assignment.role.code),
        created_at: user.createdAt,
      })),
      pagination: { ...pagination, total },
    };
  }

  /** Reads a user profile and only role assignments effective at the current time. */
  async get(actor: InternalPrincipal, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, assignments: { where: { status: "ACTIVE" }, include: { role: true } } },
    });
    if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
    const effectiveRoles = user.assignments
      .filter((a) => a.role.active && (!a.startsAt || a.startsAt <= new Date()) && (!a.endsAt || a.endsAt > new Date()))
      .map((a) => a.role.code);
    return {
      data: {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        phone_e164: user.phoneE164,
        email_verified: user.emailVerified,
        status: user.status,
        suspension_reason: user.suspensionReason,
        suspension_category: user.suspensionCategory,
        restriction_cleared_at: user.restrictionClearedAt,
        locked_at: user.lockedAt,
        lock_reason: user.lockReason,
        locked_until: user.lockedUntil,
        profile: user.profile,
        roles: effectiveRoles,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
    };
  }

  /** Updates allowlisted profile fields and commits the audit event in the same transaction. */
  async update(actor: InternalPrincipal, id: string, dto: UpdateUserDto, request: RequestAudit) {
    if (actor.id !== id && !actor.permissions.includes("user.update"))
      throw new ForbiddenException({ code: "insufficient_permission", message: "You do not have permission to perform this action." });
    const changes = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
    if (changes.length === 0)
      throw new ConflictException({ code: "empty_update", message: "Provide at least one approved profile field." });
    const data = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.first_name !== undefined ? { firstName: dto.first_name } : {}),
          ...(dto.last_name !== undefined ? { lastName: dto.last_name } : {}),
          updatedBy: actor.id,
          version: { increment: 1 },
        },
      });
      let profile;
      if (dto.display_name !== undefined || dto.locale !== undefined || dto.timezone !== undefined) {
        const [localeSetting, timezoneSetting] = await Promise.all([
          tx.configuration.findUnique({ where: { configKey: "default_locale" }, select: { valueJson: true } }),
          tx.configuration.findUnique({ where: { configKey: "default_timezone" }, select: { valueJson: true } }),
        ]);
        profile = await tx.userProfile.upsert({
          where: { userId: id },
          create: {
            userId: id,
            displayName: dto.display_name ?? null,
            locale: dto.locale ?? (typeof localeSetting?.valueJson === "string" ? localeSetting.valueJson : "en-IN"),
            timezone: dto.timezone ?? (typeof timezoneSetting?.valueJson === "string" ? timezoneSetting.valueJson : "Asia/Kolkata"),
          },
          update: {
            ...(dto.display_name !== undefined ? { displayName: dto.display_name } : {}),
            ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
            ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
          },
        });
      }
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_UPDATED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: { target_user_id: id, changed_fields: changes },
        },
        tx,
      );
      return { id: updated.id, first_name: updated.firstName, last_name: updated.lastName, profile };
    });
    return { data };
  }

  /** Changes account status, protects the final active SUPER_ADMIN, and sends notification after commit. */
  async setStatus(actor: InternalPrincipal, id: string, dto: UpdateUserStatusDto, request: RequestAudit) {
    const { status } = dto;
    if (actor.id === id)
      throw new ForbiddenException({
        code: "self_status_change_denied",
        message: "An administrator cannot change their own account status through this workflow.",
      });
    if (status === "SUSPENDED" && !dto.suspension_category)
      throw new ConflictException({
        code: "suspension_category_required",
        message: "suspension_category is required when suspending an account.",
      });
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { assignments: { where: { status: "ACTIVE" }, include: { role: true } } },
      });
      if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (user.status === status) return { data: { id, status, unchanged: true } };
      // LOCKED accounts must use the /unlock endpoint; SUSPENDED accounts must use /reinstate.
      if (user.status === "LOCKED" && status !== "SUSPENDED")
        throw new ConflictException({
          code: "account_locked_policy",
          message: "LOCKED accounts must be recovered through the /unlock endpoint, not the generic status endpoint.",
        });
      if (status === "ACTIVE" && user.status === "SUSPENDED")
        throw new ConflictException({
          code: "account_reinstatement_policy",
          message: "SUSPENDED accounts must be reinstated through the /reinstate endpoint.",
        });
      if (status === "ACTIVE" && user.status !== "DISABLED")
        throw new ConflictException({
          code: "account_enable_policy",
          message:
            "Only disabled accounts can be enabled through this endpoint; suspended or pending accounts require an approved workflow.",
        });
      const isFinalSuperAdmin =
        user.status === "ACTIVE" &&
        user.assignments.some((a) => a.role.code === "SUPER_ADMIN" && a.role.active) &&
        (await tx.user.count({
          where: { status: "ACTIVE", assignments: { some: { status: "ACTIVE", role: { code: "SUPER_ADMIN", active: true } } } },
        })) <= 1;
      if (isFinalSuperAdmin)
        throw new ConflictException({
          code: "last_super_admin_protected",
          message: "The final active SUPER_ADMIN requires an approved protected workflow.",
        });
      const updated = await tx.user.update({
        where: { id },
        data: {
          status,
          updatedBy: actor.id,
          version: { increment: 1 },
          ...(status === "SUSPENDED"
            ? {
                suspensionReason: dto.reason,
                suspensionCategory: dto.suspension_category,
                restrictionClearedAt: null,
                lockedAt: null,
                lockReason: null,
                lockedUntil: null,
              }
            : {}),
          ...(status !== "ACTIVE" ? { accessValidAfter: new Date() } : {}),
        },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action:
            status === "DISABLED"
              ? AuditAction.ACCOUNT_DISABLED
              : status === "SUSPENDED"
                ? AuditAction.ACCOUNT_SUSPENDED
                : AuditAction.ACCOUNT_ENABLED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            before_data: { status: user.status, suspension_category: user.suspensionCategory },
            after_data: { status, suspension_category: status === "SUSPENDED" ? dto.suspension_category : null },
            reason: dto.reason,
          },
        },
        tx,
      );
      return { data: { id: updated.id, status: updated.status } };
    });
    if (!("unchanged" in result.data) && status !== "SUSPENDED") {
      const user = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
      if (user)
        await this.email.sendToUser(id, status === "ACTIVE" ? AuditAction.ACCOUNT_ENABLED : AuditAction.ACCOUNT_DISABLED, {
          display_name: user.profile?.displayName ?? user.firstName ?? "there",
        });
    }
    return result;
  }

  /** Reinstates routine suspensions or opens/approves the restricted-account workflow (D2). */
  async reinstate(actor: InternalPrincipal, id: string, dto: ReinstateUserDto, request: RequestAudit) {
    if (actor.id === id)
      throw new ForbiddenException({
        code: "self_reinstatement_denied",
        message: "An administrator cannot reinstate their own suspended account.",
      });
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        include: { assignments: { where: { status: "ACTIVE" }, include: { role: true } } },
      });
      if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (user.status !== "SUSPENDED")
        throw new ConflictException({
          code: "account_reinstatement_policy",
          message: "Only SUSPENDED accounts can be reinstated. Use the /unlock endpoint for LOCKED accounts.",
        });
      const isSuperAdmin = actor.roles.includes("SUPER_ADMIN");
      const requiresApproval = user.suspensionCategory !== "ROUTINE";
      if (requiresApproval && !isSuperAdmin) {
        const pending = await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.REINSTATEMENT_REQUESTED,
            resourceType: "user",
            resourceId: id,
            ...request,
            result: "SUCCESS",
            metadata: {
              target_user_id: id,
              before_data: { status: user.status, suspension_category: user.suspensionCategory, suspension_reason: user.suspensionReason },
              after_data: { status: "SUSPENDED", reinstatement: "PENDING_SUPER_ADMIN_APPROVAL" },
              reason: dto.reason,
              approval_status: "PENDING",
            },
          },
          tx,
        );
        return { data: { id, status: user.status, reinstatement_status: "PENDING_APPROVAL", request_audit_id: pending.id } };
      }
      const now = new Date();
      const updated = await tx.user.update({
        where: { id },
        data: {
          status: "ACTIVE",
          updatedBy: actor.id,
          version: { increment: 1 },
          accessValidAfter: now,
          ...(requiresApproval ? { restrictionClearedAt: now } : {}),
        },
      });
      if (requiresApproval) {
        await this.audit.record(
          {
            actorUserId: actor.id,
            action: AuditAction.REINSTATEMENT_APPROVED,
            resourceType: "user",
            resourceId: id,
            ...request,
            result: "SUCCESS",
            metadata: {
              target_user_id: id,
              approver_user_id: actor.id,
              approval_reason: dto.reason,
              decision: "APPROVED_AND_CLEARED",
              approval_at: now.toISOString(),
            },
          },
          tx,
        );
      }
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_ACCOUNT_REINSTATED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            before_data: { status: user.status, suspension_category: user.suspensionCategory },
            after_data: { status: "ACTIVE" },
            reason: dto.reason,
            approver_user_id: requiresApproval ? actor.id : null,
            timestamp: now.toISOString(),
            outcome: "SUCCESS",
          },
        },
        tx,
      );
      return { data: { id: updated.id, status: updated.status, reinstated_by: actor.id, reinstatement_status: "REINSTATED" } };
    });
    if (result.data.reinstatement_status === "PENDING_APPROVAL") return result;
    // Best-effort notification — failure must not roll back the committed reinstatement.
    try {
      const user = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
      if (user)
        await this.email.sendToUser(id, "ACCOUNT_REINSTATED" as never, {
          display_name: user.profile?.displayName ?? user.firstName ?? "there",
        });
    } catch {
      // Notification failure is non-fatal for the reinstatement result.
    }
    return result;
  }

  /** SUPER_ADMIN approval and formal clearance for restricted-account requests (D2). */
  async approveReinstatement(actor: InternalPrincipal, id: string, dto: ApproveReinstatementDto, request: RequestAudit) {
    if (!actor.roles.includes("SUPER_ADMIN"))
      throw new ForbiddenException({
        code: "super_admin_approval_required",
        message: "Only a SUPER_ADMIN can approve restricted-account reinstatement.",
      });
    if (actor.id === id)
      throw new ForbiddenException({
        code: "self_reinstatement_denied",
        message: "An administrator cannot reinstate their own suspended account.",
      });
    const result = await this.prisma.$transaction(async (tx) => {
      const [user, requestEvent] = await Promise.all([
        tx.user.findUnique({ where: { id } }),
        tx.auditLog.findUnique({ where: { id: dto.request_audit_id } }),
      ]);
      if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (
        !requestEvent ||
        requestEvent.action !== AuditAction.REINSTATEMENT_REQUESTED ||
        requestEvent.resourceId !== id ||
        requestEvent.result !== "SUCCESS"
      )
        throw new NotFoundException({
          code: "reinstatement_request_not_found",
          message: "The pending reinstatement request was not found for this account.",
        });
      if (user.status !== "SUSPENDED" || user.suspensionCategory === "ROUTINE")
        throw new ConflictException({
          code: "reinstatement_request_stale",
          message: "The account is no longer awaiting restricted reinstatement approval.",
        });
      const relatedEvents = await tx.auditLog.findMany({
        where: {
          resourceType: "user",
          resourceId: id,
          action: { in: [AuditAction.REINSTATEMENT_APPROVED, AuditAction.REINSTATEMENT_REJECTED] },
        },
        select: { metadataJson: true },
      });
      const alreadyDecided = relatedEvents.some(
        (event) =>
          event.metadataJson &&
          typeof event.metadataJson === "object" &&
          "request_audit_id" in event.metadataJson &&
          event.metadataJson.request_audit_id === dto.request_audit_id,
      );
      if (alreadyDecided)
        throw new ConflictException({
          code: "reinstatement_request_already_decided",
          message: "This reinstatement request has already been decided.",
        });
      const now = new Date();
      const changed = await tx.user.updateMany({
        where: { id, status: "SUSPENDED", version: user.version },
        data: { status: "ACTIVE", updatedBy: actor.id, version: { increment: 1 }, restrictionClearedAt: now, accessValidAfter: now },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: "account_state_changed",
          message: "The account changed while approval was being processed. Refresh and review it.",
        });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.REINSTATEMENT_APPROVED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            request_audit_id: dto.request_audit_id,
            requester_user_id: requestEvent.actorUserId,
            approver_user_id: actor.id,
            decision: "APPROVED_AND_CLEARED",
            approval_reason: dto.approval_reason,
            approval_at: now.toISOString(),
          },
        },
        tx,
      );
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_ACCOUNT_REINSTATED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            request_audit_id: dto.request_audit_id,
            before_data: { status: "SUSPENDED", suspension_category: user.suspensionCategory },
            after_data: { status: "ACTIVE" },
            reason: dto.approval_reason,
            requester_user_id: requestEvent.actorUserId,
            approver_user_id: actor.id,
            timestamp: now.toISOString(),
            outcome: "SUCCESS",
          },
        },
        tx,
      );
      return { data: { id, status: "ACTIVE", reinstatement_status: "REINSTATED", approver_user_id: actor.id } };
    });
    try {
      const user = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
      if (user)
        await this.email.sendToUser(id, "ACCOUNT_REINSTATED" as never, {
          display_name: user.profile?.displayName ?? user.firstName ?? "there",
        });
    } catch {
      /* notification failure is non-fatal after the committed approval */
    }
    return result;
  }

  /** SUPER_ADMIN rejection for restricted-account reinstatement requests (D2). */
  async rejectReinstatement(actor: InternalPrincipal, id: string, dto: RejectReinstatementDto, request: RequestAudit) {
    if (!actor.roles.includes("SUPER_ADMIN"))
      throw new ForbiddenException({
        code: "super_admin_approval_required",
        message: "Only a SUPER_ADMIN can reject restricted-account reinstatement.",
      });
    if (actor.id === id)
      throw new ForbiddenException({
        code: "self_reinstatement_denied",
        message: "An administrator cannot decide a reinstatement request for their own account.",
      });
    return this.prisma.$transaction(async (tx) => {
      const [user, requestEvent] = await Promise.all([
        tx.user.findUnique({ where: { id } }),
        tx.auditLog.findUnique({ where: { id: dto.request_audit_id } }),
      ]);
      if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (
        !requestEvent ||
        requestEvent.action !== AuditAction.REINSTATEMENT_REQUESTED ||
        requestEvent.resourceId !== id ||
        requestEvent.result !== "SUCCESS"
      )
        throw new NotFoundException({
          code: "reinstatement_request_not_found",
          message: "The pending reinstatement request was not found for this account.",
        });
      if (user.status !== "SUSPENDED")
        throw new ConflictException({
          code: "reinstatement_request_stale",
          message: "The account is no longer awaiting reinstatement review.",
        });
      const relatedEvents = await tx.auditLog.findMany({
        where: {
          resourceType: "user",
          resourceId: id,
          action: { in: [AuditAction.REINSTATEMENT_APPROVED, AuditAction.REINSTATEMENT_REJECTED] },
        },
        select: { metadataJson: true },
      });
      if (
        relatedEvents.some(
          (event) =>
            event.metadataJson &&
            typeof event.metadataJson === "object" &&
            "request_audit_id" in event.metadataJson &&
            event.metadataJson.request_audit_id === dto.request_audit_id,
        )
      )
        throw new ConflictException({
          code: "reinstatement_request_already_decided",
          message: "This reinstatement request has already been decided.",
        });
      const now = new Date();
      const changed = await tx.user.updateMany({
        where: { id, status: "SUSPENDED", version: user.version },
        data: { updatedBy: actor.id, version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ConflictException({
          code: "account_state_changed",
          message: "The account changed while the rejection was being recorded.",
        });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.REINSTATEMENT_REJECTED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            request_audit_id: dto.request_audit_id,
            requester_user_id: requestEvent.actorUserId,
            approver_user_id: actor.id,
            decision: "REJECTED",
            rejection_reason: dto.rejection_reason,
            decision_at: now.toISOString(),
            before_data: { status: user.status, suspension_category: user.suspensionCategory },
            after_data: { status: user.status },
          },
        },
        tx,
      );
      return { data: { id, status: user.status, reinstatement_status: "REJECTED", request_audit_id: dto.request_audit_id } };
    });
  }

  /** Apply the shared application-account LOCKED state and revoke existing API tokens (D8). */
  async lock(actor: InternalPrincipal, id: string, dto: LockUserDto, request: RequestAudit) {
    if (actor.id === id)
      throw new ForbiddenException({
        code: "self_lock_denied",
        message: "An administrator cannot lock their own account through this workflow.",
      });
    const until = dto.locked_until ? new Date(dto.locked_until) : null;
    if (until && (!Number.isFinite(until.getTime()) || until <= new Date()))
      throw new ConflictException({ code: "invalid_lock_expiry", message: "locked_until must be a future ISO date-time." });
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true, status: true, version: true } });
      if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (user.status !== "ACTIVE")
        throw new ConflictException({ code: "account_lock_policy", message: "Only ACTIVE accounts can be locked." });
      const now = new Date();
      const changed = await tx.user.updateMany({
        where: { id, status: "ACTIVE", version: user.version },
        data: {
          status: "LOCKED",
          lockedAt: now,
          lockReason: dto.reason,
          lockedUntil: until,
          accessValidAfter: now,
          updatedBy: actor.id,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: "account_state_changed", message: "The account changed during the lock operation." });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.ACCOUNT_LOCKED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            before_data: { status: user.status },
            after_data: { status: "LOCKED", locked_at: now.toISOString(), locked_until: until?.toISOString() ?? null },
            reason: dto.reason,
            outcome: "SUCCESS",
          },
        },
        tx,
      );
      return { data: { id, status: "LOCKED", locked_at: now, locked_until: until } };
    });
  }

  /**
   * Unlocks a LOCKED account and returns it to ACTIVE status (D8).
   *
   * Rules enforced here:
   *  - Actor must hold admin.users.unlock permission (checked by guard).
   *  - Target account must currently be LOCKED.
   *  - Actor cannot unlock their own account (self-unlock denied).
   *  - Auth0 brute-force protection and Examinity account status are separate
   *    controls; this endpoint only manages the Examinity LOCKED state. The
   *    frontend must also initiate Auth0 brute-force unblock via the Management
   *    API if the lock originated from Auth0. That is a gap documented below.
   *
   * Auth0 gap: If the account was locked by Auth0's attack-protection policy,
   * the admin must separately call the Auth0 Management API
   * `DELETE /api/v2/users/:auth0UserId/blocks` to clear the Auth0-side block.
   * This backend only controls the Examinity application-layer LOCKED status.
   */
  async unlock(actor: InternalPrincipal, id: string, dto: UnlockUserDto, request: RequestAudit) {
    if (actor.id === id)
      throw new ForbiddenException({
        code: "self_unlock_denied",
        message: "An administrator cannot unlock their own locked account through the ordinary admin workflow.",
      });
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: { id: true, status: true, version: true, lockedAt: true, lockReason: true, lockedUntil: true },
      });
      if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (user.status !== "LOCKED")
        throw new ConflictException({
          code: "account_unlock_policy",
          message: "Only LOCKED accounts can be unlocked via this endpoint. Use /reinstate for SUSPENDED accounts.",
        });
      const updated = await tx.user.update({
        where: { id },
        data: {
          status: "ACTIVE",
          unlockedAt: new Date(),
          lockedAt: null,
          lockReason: null,
          lockedUntil: null,
          accessValidAfter: new Date(),
          updatedBy: actor.id,
          version: { increment: 1 },
        },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.ACCOUNT_UNLOCKED,
          resourceType: "user",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: id,
            before_data: { status: "LOCKED", locked_at: user.lockedAt, locked_until: user.lockedUntil, lock_reason: user.lockReason },
            after_data: { status: "ACTIVE", unlocked_at: new Date().toISOString() },
            reason: dto.reason,
            outcome: "SUCCESS",
            auth0_gap:
              "If the LOCKED state originated from Auth0 attack-protection, the Auth0 block must also be cleared " +
              "via DELETE /api/v2/users/:auth0UserId/blocks on the Auth0 Management API.",
          },
        },
        tx,
      );
      return { data: { id: updated.id, status: updated.status, unlocked_by: actor.id } };
    });
    return result;
  }

  /** Returns email preferences for the matching authenticated user only. */
  async getPreferences(actor: InternalPrincipal, id: string) {
    if (actor.id !== id)
      throw new ForbiddenException({ code: "insufficient_permission", message: "You do not have permission to perform this action." });
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, emailPreference: true },
    });
    if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
    return {
      data: {
        user_id: user.id,
        locale: user.profile?.locale ?? "en-IN",
        language: user.profile?.language ?? "en",
        timezone: user.profile?.timezone ?? "Asia/Kolkata",
        preferences: user.profile?.preferencesJson ?? {},
        transactional_email_enabled: user.emailPreference?.transactionalEnabled ?? true,
        marketing_email_enabled: user.emailPreference?.marketingEnabled ?? false,
      },
    };
  }

  /** Saves the caller's email preferences and records the update atomically. */
  async updatePreferences(actor: InternalPrincipal, id: string, dto: UpdatePreferencesDto, request: RequestAudit) {
    if (actor.id !== id)
      throw new ForbiddenException({ code: "insufficient_permission", message: "You do not have permission to perform this action." });
    const changes = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
    if (changes.length === 0)
      throw new ConflictException({ code: "empty_update", message: "Provide at least one notification preference." });
    const data = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      const preference = await tx.emailPreference.upsert({
        where: { userId: id },
        create: {
          userId: id,
          transactionalEnabled: dto.transactional_email_enabled ?? true,
          marketingEnabled: dto.marketing_email_enabled ?? false,
        },
        update: {
          ...(dto.transactional_email_enabled !== undefined ? { transactionalEnabled: dto.transactional_email_enabled } : {}),
          ...(dto.marketing_email_enabled !== undefined ? { marketingEnabled: dto.marketing_email_enabled } : {}),
        },
      });
      const profile =
        dto.locale !== undefined || dto.language !== undefined || dto.timezone !== undefined
          ? await tx.userProfile.upsert({
              where: { userId: id },
              create: {
                userId: id,
                locale: dto.locale ?? "en-IN",
                language: dto.language ?? "en",
                timezone: dto.timezone ?? "Asia/Kolkata",
              },
              update: {
                ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
                ...(dto.language !== undefined ? { language: dto.language } : {}),
                ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
              },
            })
          : null;
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.USER_UPDATED,
          resourceType: "email_preference",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: { target_user_id: id, changed_fields: changes },
        },
        tx,
      );
      return {
        user_id: id,
        locale: profile?.locale,
        language: profile?.language,
        timezone: profile?.timezone,
        transactional_email_enabled: preference.transactionalEnabled,
        marketing_email_enabled: preference.marketingEnabled,
      };
    });
    return { data };
  }

  /** Lists a target user's stored role assignments and their status/time bounds. */
  async listRoles(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      data: assignments.map((a) => ({
        role_id: a.roleId,
        code: a.role.code,
        name: a.role.name,
        status: a.status,
        starts_at: a.startsAt,
        ends_at: a.endsAt,
        revoked_at: a.revokedAt,
      })),
    };
  }

  /** Creates or reactivates a role assignment subject to role and target-user policy. */
  async assignRole(actor: InternalPrincipal, userId: string, dto: AssignRoleDto, request: RequestAudit) {
    if (actor.id === userId)
      throw new ForbiddenException({ code: "self_role_assignment_denied", message: "Users cannot grant themselves a role." });
    const result = await this.prisma.$transaction(async (tx) => {
      const [target, role] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { id: true } }),
        tx.role.findUnique({ where: { id: dto.role_id } }),
      ]);
      if (!target) throw new NotFoundException({ code: "user_not_found", message: "The application user was not found." });
      if (!role || !role.active) throw new NotFoundException({ code: "role_not_found", message: "The active role was not found." });
      if (!role.assignable || role.code === "SUPER_ADMIN")
        throw new ForbiddenException({
          code: "role_assignment_protected",
          message: "This role cannot be assigned through the ordinary role assignment API.",
        });
      if (["ADMIN", "SUPER_ADMIN"].includes(role.code) && !actor.roles.includes("SUPER_ADMIN"))
        throw new ForbiddenException({
          code: "privileged_role_assignment_denied",
          message: "Only a SUPER_ADMIN may assign a privileged role.",
        });
      const current = await tx.userRoleAssignment.findUnique({ where: { userId_roleId: { userId, roleId: role.id } } });
      if (current?.status === "ACTIVE") return { data: { id: current.id, role_id: role.id, status: "ACTIVE", unchanged: true } };
      const dates = { startsAt: dto.starts_at ? new Date(dto.starts_at) : null, endsAt: dto.ends_at ? new Date(dto.ends_at) : null };
      if (dates.startsAt && dates.endsAt && dates.endsAt <= dates.startsAt)
        throw new ConflictException({ code: "invalid_role_dates", message: "ends_at must be later than starts_at." });
      const assignment = current
        ? await tx.userRoleAssignment.update({
            where: { id: current.id },
            data: { ...dates, status: "ACTIVE", revokedAt: null, createdBy: actor.id },
          })
        : await tx.userRoleAssignment.create({ data: { userId, roleId: role.id, status: "ACTIVE", ...dates, createdBy: actor.id } });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.ROLE_ASSIGNED,
          resourceType: "user_role_assignment",
          resourceId: assignment.id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: userId,
            role_id: role.id,
            role_code: role.code,
            before_data: current ? { status: current.status, starts_at: current.startsAt, ends_at: current.endsAt } : null,
            after_data: { status: assignment.status, starts_at: assignment.startsAt, ends_at: assignment.endsAt },
            reason: dto.reason,
          },
        },
        tx,
      );
      return { data: { id: assignment.id, role_id: role.id, status: assignment.status } };
    });
    if (!("unchanged" in result.data)) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
      const role = await this.prisma.role.findUnique({ where: { id: dto.role_id }, select: { name: true } });
      if (user && role)
        await this.email.sendToUser(userId, AuditAction.ROLE_ASSIGNED, {
          display_name: user.profile?.displayName ?? user.firstName ?? "there",
          role_name: role.name,
        });
    }
    return result;
  }

  /** Revokes the target user's role assignment and audits the permission change. */
  async removeRole(actor: InternalPrincipal, userId: string, roleId: string, dto: RevokeRoleDto, request: RequestAudit) {
    const result = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.userRoleAssignment.findUnique({ where: { userId_roleId: { userId, roleId } }, include: { role: true } });
      if (!assignment) throw new NotFoundException({ code: "role_assignment_not_found", message: "The role assignment was not found." });
      if (assignment.status === "REVOKED") return { data: { id: assignment.id, status: "REVOKED", unchanged: true } };
      if (
        assignment.role.code === "SUPER_ADMIN" &&
        (await tx.user.count({
          where: { status: "ACTIVE", assignments: { some: { status: "ACTIVE", role: { code: "SUPER_ADMIN", active: true } } } },
        })) <= 1
      )
        throw new ConflictException({
          code: "last_super_admin_protected",
          message: "The final active SUPER_ADMIN requires an approved protected workflow.",
        });
      if (assignment.role.code === "SUPER_ADMIN" && !actor.roles.includes("SUPER_ADMIN"))
        throw new ForbiddenException({
          code: "privileged_role_change_denied",
          message: "Only a SUPER_ADMIN may change a privileged role assignment.",
        });
      const revoked = await tx.userRoleAssignment.update({
        where: { id: assignment.id },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.ROLE_REMOVED,
          resourceType: "user_role_assignment",
          resourceId: revoked.id,
          ...request,
          result: "SUCCESS",
          metadata: {
            target_user_id: userId,
            role_id: roleId,
            role_code: assignment.role.code,
            before_data: { status: assignment.status, starts_at: assignment.startsAt, ends_at: assignment.endsAt },
            after_data: { status: revoked.status, revoked_at: revoked.revokedAt },
            reason: dto.reason,
          },
        },
        tx,
      );
      return { data: { id: revoked.id, status: revoked.status } };
    });
    if (!("unchanged" in result.data)) {
      const [user, role] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
        this.prisma.role.findUnique({ where: { id: roleId }, select: { name: true } }),
      ]);
      if (user && role)
        await this.email.sendToUser(userId, AuditAction.ROLE_REMOVED, {
          display_name: user.profile?.displayName ?? user.firstName ?? "there",
          role_name: role.name,
        });
    }
    return result;
  }
}
