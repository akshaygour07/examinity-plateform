import { ForbiddenException, Injectable } from "@nestjs/common";
import type { JWTPayload } from "jose";
import { PrismaService } from "../database/prisma.service";
import { AuditService, type AuditInput } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import { auth0Claim, auth0EmailVerified, auth0PhoneVerified } from "./auth0-claims";
import { REGISTRATION_SOURCES, type AuthSyncDto } from "./auth-sync.dto";

@Injectable()
/** Resolves Auth0 identities to local accounts and manages identity synchronization and audit events. */
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Returns the active local account for a verified Auth0 subject; does not link by email or phone. */
  async currentUser(claims: JWTPayload & { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { auth0Subject: claims.sub },
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
    if (!user.emailVerified && !user.phoneE164)
      throw new ForbiddenException({
        code: "identity_verification_required",
        message: "Verify your email or phone through Auth0 before continuing.",
      });
    const missingProfileDefaults = user.profile
      ? []
      : await this.prisma.configuration.findMany({
          where: { configKey: { in: ["default_locale", "default_timezone"] } },
          select: { configKey: true, valueJson: true },
        });
    const profileDefault = (key: string, fallback: string) => {
      const value = missingProfileDefaults.find((item) => item.configKey === key)?.valueJson;
      return typeof value === "string" ? value : fallback;
    };
    const now = new Date();
    const activeRoles = user.assignments
      .filter((assignment) => (!assignment.startsAt || assignment.startsAt <= now) && (!assignment.endsAt || assignment.endsAt > now))
      .map((assignment) => assignment.role)
      .filter((role) => role.active);
    const roles = [...new Set(activeRoles.map((role) => role.code))];
    const permissions = [
      ...new Set(
        activeRoles.flatMap((role) => role.permissions.filter((item) => item.permission.active).map((item) => item.permission.code)),
      ),
    ];
    return {
      data: {
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.emailVerified,
          first_name: user.firstName,
          last_name: user.lastName,
          phone_e164: user.phoneE164,
          status: user.status,
          profile: {
            display_name: user.profile?.displayName ?? null,
            locale: user.profile?.locale ?? profileDefault("default_locale", "en-IN"),
            timezone: user.profile?.timezone ?? profileDefault("default_timezone", "Asia/Kolkata"),
          },
        },
        roles,
        permissions,
      },
    };
  }

  /** Synchronizes verified Auth0 claims and explicit terms acceptance into the local identity record. */
  async sync(
    claims: JWTPayload & { sub: string },
    auditContext: Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress"> = { requestId: "unknown" },
    registration: AuthSyncDto = {},
  ) {
    await this.prisma.$transaction(async (tx) => {
      const rawName = auth0Claim(claims, "name");
      const rawEmail = auth0Claim(claims, "email");
      const rawFirstName = auth0Claim(claims, "given_name");
      const rawLastName = auth0Claim(claims, "family_name");
      const rawPhone = auth0Claim(claims, "phone_number");
      const name = typeof rawName === "string" ? rawName.slice(0, 150) : undefined;
      const email = typeof rawEmail === "string" ? rawEmail.trim().slice(0, 320) : undefined;
      const firstName = typeof rawFirstName === "string" ? rawFirstName.slice(0, 100) : undefined;
      const lastName = typeof rawLastName === "string" ? rawLastName.slice(0, 100) : undefined;
      const emailVerifiedClaim = auth0Claim(claims, "email_verified");
      const emailVerified = typeof emailVerifiedClaim === "boolean" ? emailVerifiedClaim : undefined;
      const verifiedPhone =
        auth0PhoneVerified(claims) && typeof rawPhone === "string" && /^\+[1-9]\d{7,14}$/.test(rawPhone) ? rawPhone : undefined;
      const [localeSetting, timezoneSetting, notificationSetting] = await Promise.all([
        tx.configuration.findUnique({ where: { configKey: "default_locale" }, select: { valueJson: true } }),
        tx.configuration.findUnique({ where: { configKey: "default_timezone" }, select: { valueJson: true } }),
        tx.configuration.findUnique({ where: { configKey: "default_notification_preferences" }, select: { valueJson: true } }),
      ]);
      const notificationDefaults =
        notificationSetting?.valueJson && typeof notificationSetting.valueJson === "object" && !Array.isArray(notificationSetting.valueJson)
          ? (notificationSetting.valueJson as { transactional_enabled?: unknown; marketing_enabled?: unknown })
          : {};
      const existing = await tx.user.findUnique({ where: { auth0Subject: claims.sub } });
      if (existing && (existing.status === "DISABLED" || existing.status === "SUSPENDED"))
        throw new ForbiddenException({ code: "account_not_active", message: "This Examinity account is not active." });
      if (!existing && !email && !verifiedPhone && !rawPhone)
        throw new ForbiddenException({
          code: "verified_contact_required",
          message: "An email or phone claim is required to create an Examinity account.",
        });
      const termsVersion = process.env.TERMS_VERSION ?? "v1";
      const registrationSource = registration.registration_source;
      if (
        !existing &&
        (registration.terms_accepted !== true ||
          registration.terms_version !== termsVersion ||
          !registrationSource ||
          !REGISTRATION_SOURCES.includes(registrationSource))
      )
        throw new ForbiddenException({
          code: "terms_acceptance_required",
          message: "Accept the current Terms and provide a registration_source before your Examinity account can be created.",
        });
      const trustedVerified = auth0EmailVerified(claims) || verifiedPhone !== undefined;
      const nextStatus = existing?.status === "ACTIVE" ? "ACTIVE" : trustedVerified ? "ACTIVE" : "PENDING";

      // A database upsert makes concurrent first-login requests converge on one auth0_subject row.
      const user = await tx.user.upsert({
        where: { auth0Subject: claims.sub },
        create: {
          auth0Subject: claims.sub,
          email: email ?? null,
          emailNormalized: email?.toLowerCase() ?? null,
          firstName: firstName ?? null,
          lastName: lastName ?? null,
          phoneE164: verifiedPhone ?? (typeof rawPhone === "string" ? rawPhone.slice(0, 20) : null),
          emailVerified: auth0EmailVerified(claims),
          phoneVerified: verifiedPhone !== undefined,
          termsAcceptedAt: new Date(),
          termsVersion,
          status: nextStatus,
          lastLoginAt: new Date(),
        },
        update: {
          ...(email ? { email, emailNormalized: email.toLowerCase() } : {}),
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(verifiedPhone ? { phoneE164: verifiedPhone, phoneVerified: true } : {}),
          ...(emailVerified !== undefined ? { emailVerified } : {}),
          ...(existing?.status === "PENDING" && trustedVerified ? { status: "ACTIVE" } : {}),
          lastLoginAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (user.status === "ACTIVE") {
        const baselineRole = await tx.role.findUnique({ where: { code: "AUTHENTICATED_USER" }, select: { id: true } });
        if (!baselineRole) throw new Error("AUTHENTICATED_USER role is not seeded");
        await tx.userRoleAssignment.upsert({
          where: { userId_roleId: { userId: user.id, roleId: baselineRole.id } },
          update: {},
          create: { userId: user.id, roleId: baselineRole.id, status: "ACTIVE" },
        });
      }
      if (!existing && registrationSource) {
        await tx.termsAcceptance.createMany({
          data: [
            {
              userId: user.id,
              termsVersion,
              accepted: true,
              acceptedAt: new Date(),
              registrationSource,
            },
          ],
          skipDuplicates: true,
        });
      }
      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          displayName: name ?? null,
          locale: typeof localeSetting?.valueJson === "string" ? localeSetting.valueJson : "en-IN",
          timezone: typeof timezoneSetting?.valueJson === "string" ? timezoneSetting.valueJson : "Asia/Kolkata",
        },
        update: name ? { displayName: name } : {},
      });
      await tx.emailPreference.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          transactionalEnabled:
            typeof notificationDefaults.transactional_enabled === "boolean" ? notificationDefaults.transactional_enabled : true,
          marketingEnabled: typeof notificationDefaults.marketing_enabled === "boolean" ? notificationDefaults.marketing_enabled : false,
        },
        update: {},
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.LOGIN_SUCCESS,
          resourceType: "user",
          resourceId: user.id,
          ...auditContext,
          result: "SUCCESS",
          metadata: { identity_provider: "auth0" },
        },
        tx,
      );
      if (user.version === 1)
        await this.audit.record(
          {
            actorUserId: user.id,
            action: AuditAction.USER_CREATED,
            resourceType: "user",
            resourceId: user.id,
            ...auditContext,
            result: "SUCCESS",
            metadata: { identity_provider: "auth0", baseline_role: "AUTHENTICATED_USER" },
          },
          tx,
        );
    });
    const synced = await this.prisma.user.findUnique({ where: { auth0Subject: claims.sub } });
    if (synced && synced.status !== "ACTIVE") {
      return {
        data: {
          user: {
            id: synced.id,
            email: synced.email,
            email_verified: synced.emailVerified,
            first_name: synced.firstName,
            last_name: synced.lastName,
            phone_e164: synced.phoneE164,
            status: synced.status,
            profile: { display_name: null, locale: "en-IN", timezone: "Asia/Kolkata" },
          },
          roles: [],
          permissions: [],
        },
      };
    }
    return this.currentUser(claims);
  }

  /** Records the API logout event; browser/Auth0 session termination is owned by the frontend. */
  async recordLogout(
    claims: JWTPayload & { sub: string },
    auditContext: Pick<AuditInput, "requestId" | "correlationId" | "userAgent" | "ipAddress"> = { requestId: "unknown" },
  ) {
    // The web SDK owns actual session and Auth0 logout. This endpoint is retained only to meet the documented API contract.
    const user = await this.prisma.user.findUnique({ where: { auth0Subject: claims.sub }, select: { id: true } });
    if (!user) throw new ForbiddenException({ code: "identity_not_resolved", message: "The application identity could not be resolved." });
    await this.audit.record({
      actorUserId: user.id,
      action: AuditAction.LOGOUT,
      resourceType: "user",
      resourceId: user.id,
      ...auditContext,
      result: "SUCCESS",
      metadata: { identity_provider: "auth0" },
    });
    return { data: { recorded: true } };
  }
}
