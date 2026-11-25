import { createHash } from "node:crypto";
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import { PrismaService } from "../database/prisma.service";

type RequestMetadata = {
  requestId: string;
  correlationId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
};

type SessionRequest = Request & { id?: string };

export type SessionSummary = {
  id: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  location: string | null;
  created_at: Date;
  last_activity_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  is_current: boolean;
};

/** Tracks observed Examinity API bearer-token sessions; raw tokens are never persisted. */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Creates a one-way identifier for a bearer token so the credential itself is never stored. */
  fingerprint(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Registers a verified token on first use and rejects future use after server-side revocation. */
  async observeToken(args: { subject: string; token: string; expiresAt: Date; request: SessionRequest }) {
    const tokenFingerprint = this.fingerprint(args.token);
    let session = await this.prisma.apiSession.findUnique({ where: { tokenFingerprint } });
    if (session?.status === "REVOKED") {
      throw new ForbiddenException({
        code: "session_revoked",
        message: "This Examinity API session was revoked. Sign in again to continue.",
      });
    }

    if (!session) {
      const user = await this.prisma.user.findUnique({ where: { auth0Subject: args.subject }, select: { id: true } });
      if (!user) return undefined;
      const userAgent = this.header(args.request.headers["user-agent"], 500);
      try {
        session = await this.prisma.apiSession.create({
          data: {
            userId: user.id,
            tokenFingerprint,
            device: this.deviceType(userAgent),
            browser: this.browserName(userAgent),
            userAgent,
            ipAddress: this.header(args.request.ip, 64),
            expiresAt: args.expiresAt,
          },
        });
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          session = await this.prisma.apiSession.findUnique({ where: { tokenFingerprint } });
          if (session?.status === "REVOKED")
            throw new ForbiddenException({
              code: "session_revoked",
              message: "This Examinity API session was revoked. Sign in again to continue.",
            });
        } else {
          throw error;
        }
      }
      return session;
    }

    if (session.expiresAt <= new Date()) return session;
    // Avoid a database write on every API call while retaining useful last-activity data.
    if (Date.now() - session.lastActivityAt.getTime() >= 60_000) {
      session = await this.prisma.apiSession.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date(), ipAddress: this.header(args.request.ip, 64) },
      });
    }
    return session;
  }

  /** Lists this user's active sessions and recently closed sessions, marking the current token session. */
  async list(userId: string, currentSessionId: string | undefined, metadata: RequestMetadata) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const sessions = await this.prisma.apiSession.findMany({
      where: { userId, OR: [{ status: "ACTIVE" }, { createdAt: { gte: cutoff } }] },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.SESSION_LIST_VIEWED,
      resourceType: "api_session",
      resourceId: null,
      ...metadata,
      result: "SUCCESS",
      metadata: { returned_count: sessions.length },
    });
    return {
      data: sessions.map((session) => this.format(session, currentSessionId)),
      meta: { current_session_id: currentSessionId ?? null },
    };
  }

  /** Returns a session only when it belongs to the authenticated user. */
  async get(userId: string, sessionId: string, currentSessionId: string | undefined) {
    const session = await this.prisma.apiSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException({ code: "session_not_found", message: "The session was not found." });
    return { data: this.format(session, currentSessionId) };
  }

  /** Revokes one unexpired API token session and writes its audit event atomically. */
  async revoke(userId: string, actorUserId: string, sessionId: string, metadata: RequestMetadata) {
    const existing = await this.prisma.apiSession.findFirst({ where: { id: sessionId, userId } });
    if (!existing) throw new NotFoundException({ code: "session_not_found", message: "The session was not found." });
    if (existing.status === "REVOKED") return { data: { id: existing.id, status: "REVOKED", unchanged: true } };
    if (existing.expiresAt <= new Date())
      throw new ConflictException({ code: "session_expired", message: "An expired session cannot be revoked." });

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.apiSession.updateMany({
        where: { id: existing.id, userId, status: "ACTIVE", revokedAt: null, expiresAt: { gt: now } },
        data: { status: "REVOKED", revokedAt: now, revokedBy: actorUserId },
      });
      if (result.count === 0) return;
      await this.audit.record(
        {
          actorUserId,
          action: AuditAction.SESSION_REVOKED,
          resourceType: "api_session",
          resourceId: existing.id,
          ...metadata,
          result: "SUCCESS",
          metadata: { before_data: { status: "ACTIVE" }, after_data: { status: "REVOKED" }, target_user_id: userId },
        },
        tx,
      );
    });
    return { data: { id: existing.id, status: "REVOKED", unchanged: false } };
  }

  /** Revokes every other active API token session while preserving the caller's current session. */
  async revokeOthers(userId: string, actorUserId: string, currentSessionId: string | undefined, metadata: RequestMetadata) {
    if (!currentSessionId)
      throw new ConflictException({ code: "current_session_unavailable", message: "The current API session could not be identified." });
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.apiSession.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          status: "ACTIVE",
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { status: "REVOKED", revokedAt: now, revokedBy: actorUserId },
      });
      await this.audit.record(
        {
          actorUserId,
          action: AuditAction.SESSIONS_REVOKED_OTHERS,
          resourceType: "api_session",
          resourceId: currentSessionId,
          ...metadata,
          result: "SUCCESS",
          metadata: {
            revoked_count: result.count,
            current_session_preserved: true,
            target_user_id: userId,
            outcome: "SUCCESS",
          },
        },
        tx,
      );
      return { data: { revoked_count: result.count, current_session_id: currentSessionId } };
    });
  }

  /** Revokes the authenticated request's API session during logout; browser and Auth0 logout remain frontend-owned. */
  async revokeCurrent(sessionId: string | undefined, userId: string | undefined, metadata: RequestMetadata) {
    if (!sessionId || !userId) return;
    await this.revoke(userId, userId, sessionId, metadata);
  }

  /** Maps persistence fields to the public response and derives expiry/current-session status. */
  private format(
    session: {
      id: string;
      status: string;
      device: string | null;
      browser: string | null;
      ipAddress: string | null;
      location: string | null;
      createdAt: Date;
      lastActivityAt: Date;
      expiresAt: Date;
      revokedAt: Date | null;
    },
    currentSessionId: string | undefined,
  ): SessionSummary {
    const status = session.status === "REVOKED" ? "REVOKED" : session.expiresAt <= new Date() ? "EXPIRED" : "ACTIVE";
    return {
      id: session.id,
      status,
      device: session.device,
      browser: session.browser,
      ip_address: session.ipAddress,
      location: session.location,
      created_at: session.createdAt,
      last_activity_at: session.lastActivityAt,
      expires_at: session.expiresAt,
      revoked_at: session.revokedAt,
      is_current: session.id === currentSessionId,
    };
  }

  private header(value: string | string[] | undefined, maxLength: number) {
    const first = Array.isArray(value) ? value[0] : value;
    return first?.slice(0, maxLength) ?? null;
  }

  private deviceType(userAgent: string | null) {
    if (!userAgent) return "Unknown";
    if (/ipad|tablet/i.test(userAgent)) return "Tablet";
    if (/mobile|iphone|android/i.test(userAgent)) return "Mobile";
    return "Desktop";
  }

  private browserName(userAgent: string | null) {
    if (!userAgent) return "Unknown";
    if (/edg\//i.test(userAgent)) return "Edge";
    if (/opr\//i.test(userAgent)) return "Opera";
    if (/firefox\//i.test(userAgent)) return "Firefox";
    if (/chrome\//i.test(userAgent) && !/chromium/i.test(userAgent)) return "Chrome";
    if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return "Safari";
    return "Unknown";
  }

  private isUniqueConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
