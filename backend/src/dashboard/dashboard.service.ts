import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

type DashboardLink = {
  key: string;
  label: string;
  href: string;
  required_permission?: string;
};

/** Builds the authenticated Module 1 dashboard from the user's current profile and effective permissions. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the active account for an Auth0 subject and derives permitted navigation links.
   * Permission evaluation uses active, in-window assignments, active roles, and active permissions.
   */
  async getForSubject(subject: string) {
    const user = await this.prisma.user.findUnique({
      where: { auth0Subject: subject },
      include: {
        profile: true,
        assignments: {
          where: { status: "ACTIVE" },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user)
      throw new ForbiddenException({
        code: "identity_not_provisioned",
        message: "No Examinity application account is linked to this identity.",
      });
    if (user.status !== "ACTIVE")
      throw new ForbiddenException({ code: "account_not_active", message: "This Examinity account is not active." });

    // A user is considered verified when either their email or their phone number
    // has been verified.  `phoneVerified` is the authoritative boolean sourced from
    // Auth0 claims during synchronisation — checking phoneE164 presence alone would
    // allow an unverified phone number to bypass this gate.
    const identityVerified = user.emailVerified || user.phoneVerified;
    if (!identityVerified)
      throw new ForbiddenException({
        code: "identity_verification_required",
        message: "Verify your email or phone through Auth0 before continuing.",
      });

    const now = new Date();
    const effectiveRoles = user.assignments
      .filter(
        (assignment) =>
          assignment.role.active && (!assignment.startsAt || assignment.startsAt <= now) && (!assignment.endsAt || assignment.endsAt > now),
      )
      .map((assignment) => assignment.role);
    const permissions = new Set(
      effectiveRoles.flatMap((role) => role.permissions.filter((item) => item.permission.active).map((item) => item.permission.code)),
    );
    const displayName = user.profile?.displayName ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || null);

    return {
      data: {
        welcome_message: displayName ? `Welcome, ${displayName}` : "Welcome",
        profile: {
          id: user.id,
          display_name: displayName,
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          email_verified: user.emailVerified,
          phone_e164: user.phoneE164,
          profile: {
            locale: user.profile?.locale ?? "en-IN",
            timezone: user.profile?.timezone ?? "Asia/Kolkata",
          },
        },
        application_status: { account: user.status },
        navigation: this.permittedNavigation(permissions),
      },
    };
  }

  /** Uses existing shared platform tables; no dashboard statistics are stored separately. */
  async getAdminSummary() {
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      suspendedUsers,
      unverifiedEmail,
      unverifiedMobile,
      administrators,
      recentActivity,
      activeSettings,
      enabledFlags,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { status: "DISABLED" } }),
      this.prisma.user.count({ where: { status: "SUSPENDED" } }),
      this.prisma.user.count({ where: { email: { not: null }, emailVerified: false } }),
      this.prisma.user.count({ where: { phoneE164: { not: null }, phoneVerified: false } }),
      this.prisma.user.count({
        where: {
          status: "ACTIVE",
          assignments: { some: { status: "ACTIVE", role: { active: true, code: { in: ["ADMIN", "SUPER_ADMIN"] } } } },
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 10,
        select: { id: true, actorUserId: true, action: true, resourceType: true, resourceId: true, result: true, occurredAt: true },
      }),
      this.prisma.configuration.count({ where: { status: "ACTIVE" } }),
      this.prisma.featureFlag.count({ where: { enabled: true } }),
    ]);
    return {
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          disabled: disabledUsers,
          suspended: suspendedUsers,
          unverified_email: unverifiedEmail,
          unverified_mobile: unverifiedMobile,
          administrators,
        },
        system: { active_settings: activeSettings, enabled_feature_flags: enabledFlags },
        recent_admin_activity: recentActivity.map((event) => ({
          id: event.id,
          actor_user_id: event.actorUserId,
          action: event.action,
          resource_type: event.resourceType,
          resource_id: event.resourceId,
          outcome: event.result,
          occurred_at: event.occurredAt,
        })),
      },
    };
  }

  /** Includes self-service profile unconditionally and admin destinations only when their permission is effective. */
  private permittedNavigation(permissions: Set<string>): DashboardLink[] {
    const candidates: Array<DashboardLink & { required_permission?: string }> = [
      { key: "profile", label: "My Profile", href: "/profile" },
      { key: "users", label: "User Administration", href: "/admin/users", required_permission: "admin.users.view" },
      { key: "roles", label: "Roles and Permissions", href: "/admin/roles", required_permission: "admin.roles.view" },
      { key: "audit", label: "Audit Logs", href: "/admin/audit-logs", required_permission: "admin.audit.view" },
      {
        key: "configurations",
        label: "Platform Configuration",
        href: "/admin/configurations",
        required_permission: "admin.settings.view",
      },
      {
        key: "feature_flags",
        label: "Feature Flags",
        href: "/admin/feature-flags",
        required_permission: "admin.feature_flags.view",
      },
      { key: "media", label: "Media", href: "/media", required_permission: "media.read" },
    ];

    return candidates.filter((item) => !item.required_permission || permissions.has(item.required_permission));
  }
}
