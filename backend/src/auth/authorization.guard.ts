import { CanActivate, ExecutionContext, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { JWTPayload } from "jose";
import { PrismaService } from "../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import { REQUIRED_PERMISSIONS } from "./authorization";
import { auth0EmailVerified, auth0PhoneVerified } from "./auth0-claims";
import { hasCompletedMfa, isAdminApplicationToken } from "./admin-access-policy";
import type { AuthenticatedRequest, InternalPrincipal } from "./auth0.guard";

@Injectable()
/** Enforces permission metadata against the authenticated principal's currently effective permissions. */
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const subject = request.auth0?.sub;
    let principal: InternalPrincipal | undefined;
    if (subject) {
      let user = await this.prisma.user.findUnique({
        where: { auth0Subject: subject },
        include: {
          assignments: { where: { status: "ACTIVE" }, include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
      });
      if (user?.status === "LOCKED" && user.lockedUntil && user.lockedUntil <= new Date()) {
        const now = new Date();
        const recovered = await this.prisma.$transaction(async (tx) => {
          const changed = await tx.user.updateMany({
            where: { id: user!.id, status: "LOCKED", version: user!.version, lockedUntil: { lte: now } },
            data: {
              status: "ACTIVE",
              unlockedAt: now,
              lockedAt: null,
              lockReason: null,
              lockedUntil: null,
              accessValidAfter: now,
              version: { increment: 1 },
            },
          });
          if (changed.count === 1)
            await this.audit.record(
              {
                actorUserId: null,
                action: AuditAction.ACCOUNT_UNLOCKED,
                resourceType: "user",
                resourceId: user!.id,
                requestId: request.id ?? "unknown",
                correlationId: this.safeCorrelation(request.headers["x-correlation-id"]),
                result: "SUCCESS",
                metadata: {
                  target_user_id: user!.id,
                  before_data: { status: "LOCKED", locked_until: user!.lockedUntil!.toISOString() },
                  after_data: { status: "ACTIVE" },
                  reason: "Automatic unlock after the persisted lock expiry.",
                  outcome: "SUCCESS",
                },
                ipAddress: request.ip ?? null,
                userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"].slice(0, 500) : null,
              },
              tx,
            );
          return changed;
        });
        if (recovered.count === 1) {
          user = await this.prisma.user.findUnique({
            where: { auth0Subject: subject },
            include: {
              assignments: {
                where: { status: "ACTIVE" },
                include: { role: { include: { permissions: { include: { permission: true } } } } },
              },
            },
          });
        }
      }
      if (user) {
        const now = new Date();
        const effective = user.assignments.filter(
          (item) => (!item.startsAt || item.startsAt <= now) && (!item.endsAt || item.endsAt > now) && item.role.active,
        );
        principal = {
          id: user.id,
          subject: user.auth0Subject,
          claims: request.auth0 as JWTPayload & { sub: string },
          status: user.status,
          accessValidAfter: user.accessValidAfter,
          roles: [...new Set(effective.map((item) => item.role.code))],
          permissions: [
            ...new Set(
              effective.flatMap((item) =>
                item.role.permissions.filter((entry) => entry.permission.active).map((entry) => entry.permission.code),
              ),
            ),
          ],
        };
        request.principal = principal;
      }
    }

    const reason = !principal
      ? "identity_not_provisioned"
      : principal.status !== "ACTIVE"
        ? "account_not_active"
        : principal.accessValidAfter &&
            (principal.claims.iat === undefined || Number(principal.claims.iat) < Math.ceil(principal.accessValidAfter.getTime() / 1000))
          ? "session_invalidated"
          : !auth0EmailVerified(principal.claims) && !auth0PhoneVerified(principal.claims)
            ? "identity_verification_required"
            : required.some((permission) => !principal!.permissions.includes(permission))
              ? "insufficient_permission"
              : required.length > 0 && !process.env.AUTH0_ADMIN_CLIENT_ID
                ? "admin_policy_unconfigured"
                : required.length > 0 && !isAdminApplicationToken(principal.claims, process.env.AUTH0_ADMIN_CLIENT_ID!)
                  ? "admin_application_required"
                  : required.length > 0 && !hasCompletedMfa(principal.claims)
                    ? "mfa_required"
                    : undefined;
    if (reason) {
      const req = request as Request & { id?: string };
      await this.audit.record({
        actorUserId: principal?.id ?? null,
        action: AuditAction.ACCESS_DENIED,
        resourceType: "api_route",
        resourceId: null,
        requestId: req.id ?? "unknown",
        correlationId: this.safeCorrelation(req.headers["x-correlation-id"]),
        result: "FAILURE",
        metadata: { method: req.method, route: req.route?.path ?? req.path, reason },
        ipAddress: req.ip ?? null,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
      });
      if (reason === "admin_policy_unconfigured")
        throw new ServiceUnavailableException({
          code: reason,
          message: "Administrative authentication policy is not configured.",
        });
      throw new ForbiddenException({
        code: reason,
        message:
          reason === "insufficient_permission"
            ? "You do not have permission to perform this action."
            : reason === "identity_verification_required"
              ? "Verify your email or phone through Auth0 before continuing."
              : reason === "admin_application_required"
                ? "Use the dedicated administrator application to access this API."
                : reason === "mfa_required"
                  ? "Complete multi-factor authentication before using administrative APIs."
                  : reason === "session_invalidated"
                    ? "This session has been invalidated. Sign in again to continue."
                    : "The application identity is not active.",
      });
    }
    return true;
  }

  private safeCorrelation(value: string | string[] | undefined): string | null {
    const candidate = Array.isArray(value) ? value[0] : value;
    return candidate && /^[A-Za-z0-9._-]{1,100}$/.test(candidate) ? candidate : null;
  }
}
