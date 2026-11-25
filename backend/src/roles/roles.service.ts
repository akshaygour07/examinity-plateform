import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import type { InternalPrincipal } from "../auth/auth0.guard";
import type { AuditInput } from "../audit/audit.service";
import { UpdateRolePermissionsDto } from "./update-role-permissions.dto";
import { PageQueryDto } from "../common/page-query.dto";
import { effectivePagination } from "../common/effective-pagination";

type RequestAudit = Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress">;

function permissionResponse(permission: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
  resource: string;
  action: string;
  systemPermission: boolean;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: permission.id,
    code: permission.code,
    name: permission.name,
    description: permission.description,
    module: permission.module,
    resource: permission.resource,
    action: permission.action,
    is_system: permission.systemPermission,
    active: permission.active,
    created_at: permission.createdAt,
  };
}

@Injectable()
/** Reads role/permission catalogues and safely updates permissions on non-system roles. */
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  /** Lists active roles without exposing inactive catalogue entries. */
  async list(query: PageQueryDto) {
    const pagination = await effectivePagination(this.prisma, query);
    const where = { active: true };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.role.count({ where }),
      this.prisma.role.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (pagination.page - 1) * pagination.page_size,
        take: pagination.page_size,
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          systemRole: true,
          protectedRole: true,
          assignable: true,
          active: true,
        },
      }),
    ]);
    return {
      data: data.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        system_role: role.systemRole,
        is_protected: role.protectedRole,
        assignable: role.assignable,
        active: role.active,
      })),
      pagination: { ...pagination, total },
    };
  }
  /** Reads one active role and its active permissions. */
  async get(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { where: { permission: { active: true } }, include: { permission: true }, orderBy: { permission: { code: "asc" } } },
        assignments: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!role || !role.active) throw new NotFoundException({ code: "role_not_found", message: "The active role was not found." });
    return {
      data: {
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        system_role: role.systemRole,
        is_protected: role.protectedRole,
        assignable: role.assignable,
        active: role.active,
        permissions: role.permissions.map((rp) => permissionResponse(rp.permission)),
        assignment_history: role.assignments.map((assignment) => ({
          user_id: assignment.userId,
          email: assignment.user.email,
          first_name: assignment.user.firstName,
          last_name: assignment.user.lastName,
          status: assignment.status,
          assigned_at: assignment.createdAt,
          assigned_by: assignment.createdBy,
          starts_at: assignment.startsAt,
          ends_at: assignment.endsAt,
          revoked_at: assignment.revokedAt,
        })),
      },
    };
  }
  /** Lists active permission definitions for administrative clients. */
  async permissions(query: PageQueryDto) {
    const pagination = await effectivePagination(this.prisma, query);
    const where = { active: true };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.permission.count({ where }),
      this.prisma.permission.findMany({
        where,
        orderBy: [{ module: "asc" }, { code: "asc" }],
        skip: (pagination.page - 1) * pagination.page_size,
        take: pagination.page_size,
      }),
    ]);
    return { data: data.map(permissionResponse), pagination: { ...pagination, total } };
  }
  /** Lists active permissions assigned to an active role. */
  async rolePermissions(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
    if (!role || !role.active) throw new NotFoundException({ code: "role_not_found", message: "The active role was not found." });
    return { data: role.permissions.filter((rp) => rp.permission.active).map((rp) => permissionResponse(rp.permission)) };
  }
  /** Replaces a custom role's permission mappings atomically; system roles are protected. */
  async replacePermissions(actor: InternalPrincipal, id: string, dto: UpdateRolePermissionsDto, request: RequestAudit) {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
      if (!role || !role.active) throw new NotFoundException({ code: "role_not_found", message: "The active role was not found." });
      if (role.systemRole || role.protectedRole)
        throw new ConflictException({
          code: "system_role_protected",
          message: "System-defined role permissions require an approved protected change process.",
        });
      const permissions = await tx.permission.findMany({
        where: { id: { in: dto.permission_ids }, active: true },
        select: { id: true, code: true },
      });
      if (permissions.length !== dto.permission_ids.length)
        throw new ConflictException({ code: "unknown_permission", message: "Every permission must be registered and active." });
      const previousIds = role.permissions.map((rp) => rp.permissionId);
      const nextIds = dto.permission_ids;
      const addedIds = nextIds.filter((permissionId) => !previousIds.includes(permissionId));
      const removedIds = previousIds.filter((permissionId) => !nextIds.includes(permissionId));
      if (!addedIds.length && !removedIds.length) return { data: { role_id: id, unchanged: true } };
      const permissionCodeById = new Map(permissions.map((permission) => [permission.id, permission.code]));
      const unauthorized = addedIds
        .map((permissionId) => permissionCodeById.get(permissionId)!)
        .filter((code) => !actor.permissions.includes(code));
      if (unauthorized.length)
        throw new ForbiddenException({
          code: "permission_not_delegable",
          message: "You cannot grant permissions you do not hold.",
          details: { permissions: unauthorized },
        });
      await tx.rolePermission.deleteMany({ where: { roleId: id, permissionId: { in: removedIds } } });
      if (addedIds.length) await tx.rolePermission.createMany({ data: addedIds.map((permissionId) => ({ roleId: id, permissionId })) });
      const codeById = permissionCodeById;
      await this.audit.record(
        {
          actorUserId: actor.id,
          action: AuditAction.PERMISSION_CHANGED,
          resourceType: "role",
          resourceId: id,
          ...request,
          result: "SUCCESS",
          metadata: {
            role_code: role.code,
            added_permissions: addedIds.map((permissionId) => codeById.get(permissionId)!),
            removed_permissions: role.permissions.filter((rp) => removedIds.includes(rp.permissionId)).map((rp) => rp.permission.code),
            before_data: role.permissions.map((rp) => ({ permission_id: rp.permissionId, code: rp.permission.code })),
            after_data: permissions.map((permission) => ({ permission_id: permission.id, code: permission.code })),
            reason: dto.reason,
          },
        },
        tx,
      );
      return { data: { role_id: id, permission_ids: nextIds } };
    });
  }
}
