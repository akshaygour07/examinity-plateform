import { CanActivate, ExecutionContext, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { AuditAction } from "../audit/audit-actions";
import { SessionsService } from "../sessions/sessions.service";

export type InternalPrincipal = {
  id: string;
  subject: string;
  claims: JWTPayload & { sub: string };
  status: string;
  accessValidAfter?: Date | null;
  roles: string[];
  permissions: string[];
};
/** Express request enriched with verified Auth0 claims and the resolved local principal. */
export type AuthenticatedRequest = Request & {
  auth0: JWTPayload & { sub: string };
  principal?: InternalPrincipal;
  apiSession?: { id: string; userId: string };
  id?: string;
};

@Injectable()
/** Verifies Auth0 API access tokens and resolves their subject to an active local principal. */
export class Auth0Guard implements CanActivate {
  private jwksPromise?: Promise<ReturnType<typeof createRemoteJWKSet>>;
  constructor(
    @Optional() private readonly audit?: AuditService,
    @Optional() private readonly sessions?: SessionsService,
  ) {}

  private async recordDenied(request: AuthenticatedRequest, reason: string) {
    if (!this.audit) return;
    try {
      await this.audit.record({
        actorUserId: null,
        action: AuditAction.ACCESS_DENIED,
        resourceType: "api_route",
        resourceId: null,
        requestId: request.id ?? "unknown",
        result: "FAILURE",
        metadata: { method: request.method, route: request.route?.path ?? request.path, reason },
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"].slice(0, 500) : null,
        ipAddress: request.ip ?? null,
      });
    } catch {
      /* authentication remains denied if audit storage is unavailable */
    }
  }

  private async trustedJwks(issuer: string) {
    if (!this.jwksPromise) {
      this.jwksPromise = (async () => {
        const discoveryUrl = new URL(".well-known/openid-configuration", issuer);
        const response = await fetch(discoveryUrl, { signal: AbortSignal.timeout(5_000), redirect: "error" });
        if (!response.ok) throw new Error("Auth0 discovery metadata is unavailable");
        const metadata = (await response.json()) as { issuer?: string; jwks_uri?: string };
        const normalizedIssuer = issuer.endsWith("/") ? issuer : `${issuer}/`;
        if (metadata.issuer !== normalizedIssuer || !metadata.jwks_uri)
          throw new Error("Auth0 discovery metadata does not match the configured issuer");
        const jwksUrl = new URL(metadata.jwks_uri);
        if (process.env.NODE_ENV === "production" && jwksUrl.protocol !== "https:")
          throw new Error("Auth0 JWKS endpoint must use HTTPS in production");
        return createRemoteJWKSet(jwksUrl, { timeoutDuration: 5_000, cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
      })().catch((error: unknown) => {
        this.jwksPromise = undefined;
        throw new ServiceUnavailableException(
          { code: "auth_keys_unavailable", message: "Authentication keys are temporarily unavailable." },
          { cause: error },
        );
      });
    }
    return this.jwksPromise;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token) {
      await this.recordDenied(request, "missing_or_malformed_bearer");
      throw new UnauthorizedException({ code: "unauthorized", message: "A valid bearer access token is required." });
    }

    const issuer = process.env.AUTH0_ISSUER_BASE_URL;
    const audience = process.env.API_AUDIENCE;
    if (!issuer || !audience)
      throw new ServiceUnavailableException({ code: "auth_configuration_missing", message: "API authentication is not configured." });
    const clockTolerance = Number(process.env.JWT_CLOCK_TOLERANCE_SECONDS ?? 60);
    if (!Number.isInteger(clockTolerance) || clockTolerance < 0 || clockTolerance > 300)
      throw new ServiceUnavailableException({
        code: "auth_configuration_invalid",
        message: "API authentication is not configured correctly.",
      });
    let payload: JWTPayload;
    try {
      const issuerUrl = new URL(issuer);
      if (issuerUrl.protocol !== "https:" && process.env.NODE_ENV === "production")
        throw new Error("Auth0 issuer must use HTTPS in production");
      const jwks = await this.trustedJwks(issuer);
      const verified = await jwtVerify(token, jwks, {
        issuer: issuer.endsWith("/") ? issuer : `${issuer}/`,
        audience,
        algorithms: ["RS256"],
        clockTolerance,
        requiredClaims: ["iss", "sub", "aud", "iat", "exp"],
      });
      payload = verified.payload;
      if (typeof payload.sub !== "string" || payload.sub.length === 0 || "nonce" in payload)
        throw new Error("Token is not an API access token with a valid subject");
      request.auth0 = payload as JWTPayload & { sub: string };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code.startsWith("ERR_JWKS_") && code !== "ERR_JWKS_NO_MATCHING_KEY") {
        throw new ServiceUnavailableException({
          code: "auth_keys_unavailable",
          message: "Authentication keys are temporarily unavailable.",
        });
      }
      await this.recordDenied(request, "invalid_access_token");
      throw new UnauthorizedException({ code: "invalid_access_token", message: "The bearer access token is invalid or expired." });
    }
    if (this.sessions && typeof payload.exp === "number") {
      const session = await this.sessions.observeToken({
        subject: payload.sub!,
        token,
        expiresAt: new Date(payload.exp * 1000),
        request,
      });
      if (session) request.apiSession = { id: session.id, userId: session.userId };
    }
    return true;
  }
}
