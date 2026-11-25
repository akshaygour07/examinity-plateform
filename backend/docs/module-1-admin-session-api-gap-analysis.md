# ADM-018 shared session API implementation

Reviewed against D1 in `Developer%20Queries%20Admin%20Module.txt`, the Module 1 backend source, Prisma schema, and the local Admin QA flow on 2026-11-03.

## Approved scope

D1 confirms that an authenticated administrator must be able to list their own active sessions, inspect session/device details when available, identify the current session, revoke one of their sessions, and revoke all other sessions while preserving the current session. These are shared Module 1 identity/session capabilities consumed by ADM-018. The Admin Module must not create a parallel session subsystem.

## Implemented behavior

- `GET /api/v1/me/sessions`, `GET /api/v1/me/sessions/:sessionId`, `DELETE /api/v1/me/sessions/:sessionId`, and `POST /api/v1/me/sessions/revoke-others` implement the Admin aliases and require `admin.sessions.view` or `admin.sessions.revoke` plus the dedicated Admin application and MFA policy.
- Module 1 provides the same self-service behavior at `GET/DELETE /api/v1/auth/me/sessions`, `GET /api/v1/auth/me/sessions/:sessionId`, and `POST /api/v1/auth/me/sessions/revoke-others` for any active, verified signed-in user.
- `identity.api_sessions` stores an internal session ID, owner, SHA-256 fingerprint of the already-validated API bearer token, observed device/browser/IP, activity and token-expiry times, and revocation fields. The bearer token itself is never persisted. Session identity comes from the verified token, never from a caller-supplied user ID.
- First API use registers a token session. The authentication guard checks its revocation on every protected API request, so a revoked token receives `403 session_revoked`. Revoke-others retains the current token session. Logout revokes the current API token session and records the logout event.
- Session ownership is enforced in queries; a foreign session is returned as 404. List returns active rows and rows created in the last 30 days, with a maximum of 100. Expired sessions are reported as `EXPIRED` and are not revocable.
- Postman ADM-018 issues separate local admin tokens, registers them through API use, then demonstrates list/detail/revoke/revoke-others and rejection of revoked tokens. The Module 1 collection contains the equivalent regular-user flow.

## Scope and limits

- This controls Examinity API access for tokens observed by this API. It does not terminate Auth0 SSO, revoke an Auth0 refresh token, or clear a browser/BFF cookie. A token that has never called the API has no row to list. A newly issued token is a new API session.
- Device/browser parsing is best effort from the User-Agent. IP is the request IP; location is currently null because no trusted geolocation service is configured.
- `POST /auth/logout` revokes the presented API token. The frontend must also clear its own session and perform Auth0 logout as required.
- Every successful list/revoke operation is written to the shared audit log. Session records are retained for account history; list omits old revoked records after 30 days.

## Review status

**ADM-018 and the shared Module 1 session flow are implemented.** The local walkthrough is `corepack pnpm client:demo:check`; Postman walkthroughs are in ADM-018 and `13 - Session management (Module 1)`. Deploy the migration before running against a deployment.
