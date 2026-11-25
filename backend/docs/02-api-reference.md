# Examinity Module 1 — API Reference

Audience: client and integration engineers
Revision: 1.0 · Date: 4 November 2026

## Contents

- [1. Using this reference](#1-using-this-reference)
- [2. API index](#2-api-index)
- [3. Health](#3-health)
- [4. Authentication and identity](#4-authentication-and-identity)
- [5. Admin dashboard](#5-admin-dashboard)
- [6. User dashboard](#6-user-dashboard)
- [7. User and account lifecycle](#7-user-and-account-lifecycle)
- [8. Role and permission management](#8-role-and-permission-management)
- [9. Audit](#9-audit)
- [10. Configuration and feature flags](#10-configuration-and-feature-flags)
- [11. API sessions](#11-api-sessions)
- [12. Media](#12-media)
- [13. Provider callback](#13-provider-callback)
- [14. Shared response and error schemas](#14-shared-response-and-error-schemas)
- [15. Known contract documentation limitations](#15-known-contract-documentation-limitations)
- [16. Complete route-level operation catalog](#16-complete-route-level-operation-catalog)

Coverage: 70 operations from the running API OpenAPI document at /api/docs-json

Base path: https://<api-host>/api/v1 (development example: http://localhost:4000/api/v1)

16. Complete route-level operation catalog

## 1. Using this reference

All paths in the catalog are full route paths, including /api/v1, except health probes, which are /health/live and /health/ready. Send JSON bodies with Content-Type: application/json when a request has a body. Path IDs are internal Examinity UUIDs unless the route uses a string key such as a setting or flag key.

Protected routes require an Auth0 API access token in Authorization: Bearer <access-token>. Do not send an ID token. Admin endpoints additionally require the configured Admin application/MFA context and a permission granted by server-side RBAC. The provider callback uses its configured provider bearer secret rather than an end-user token. Health endpoints are public.

### Success envelope

```
{
"data": {},
"meta": {
"request_id": "<request-id>"
}
}
```

The data value is the handler result described per endpoint. Paginated results add page, page_size, total and total_pages to meta; session list also includes current_session_id in meta. These common fields are added by the response interceptor.

### Error envelope

```
{
"error": {
"code": "validation_error",
"message": "The request contains invalid fields.",
"details": { "fields": ["field validation message"] },
"request_id": "<request-id>"
}
}
```

Typical status classes: 400 invalid input, 401 missing/invalid token, 403 inactive/unverified identity or missing permission/session revoked, 404 missing or non-owned resource, 409 state/version conflict, 429 rate limit, and 500 generic unexpected failure. Exact codes depend on the operation and failure condition.

### Pagination and mutation conventions

List routes accept page and page_size; maximum page size is 100 where specified. Admin user search supports exact user ID, name/email/general search, status, mobile, verification flags, role and creation range. Settings/feature flag updates require current expected_version and a reason. Role/account lifecycle mutations require reasons as specified. Media presign requires Idempotency-Key.

## 2. API index

The operation list below follows the live OpenAPI paths. OpenAPI entries can include Admin aliases over shared Module 1 handlers. Aliases use the same permission and persistence rules.

The exhaustive method/path index and route-level input/output summary is in section 16, generated from all operations in the live OpenAPI document. Sections 3–13 below explain the client workflow contracts in a more readable form. Refer to the table of contents for section page numbers in a paginated Word/PDF export.

## 3. Health

### GET /health/live — Process liveness

- Authentication: none.

- Request: no path/query/body inputs.

- Success: 200; data is { "status": "ok" }.

- Failure: process/network failure; dependency status is intentionally not checked here.

### GET /health/ready — API and database readiness

- Authentication: none.

- Request: no path/query/body inputs.

- Success: 200; data is { "status": "ready" } when required Auth0 issuer/audience configuration and PostgreSQL are valid.

- Failure: 503 if required configuration is missing/invalid or database is unavailable.

## 4. Authentication and identity

### GET /api/v1/auth/me — Current application identity

- Authentication: Auth0 API access token; identity must be provisioned, active and sufficiently verified.

- Request: no body.

- Success: 200; data contains user (internal ID, email/verification, names, phone, status and profile), roles[], and permissions[].

- Errors: 401 invalid token; 403 identity_not_provisioned, account_not_active or identity_verification_required.

### POST /api/v1/auth/sync — Synchronize Auth0 identity

- Authentication: Auth0 API access token.

- Request body: optional JSON at the OpenAPI layer; first provisioning requires:

```
{
"terms_accepted": true,
"terms_version": "v1",
"registration_source": "EMAIL"
}
```

registration_source is EMAIL, PHONE or SOCIAL. First provisioning must explicitly accept current terms. Unverified identities stay pending and have no roles.

- Success: 200; data contains the same identity shape as /auth/me (pending users may have empty roles/permissions).

- Errors: token validation errors; validation/terms failures; account state is not silently changed to active.

### POST /api/v1/auth/logout — Revoke current API token session

- Authentication: Auth0 API access token.

- Request: no body.

- Success: Nest default 201; handler records { "recorded": true } and revokes the observed API session.

- Limit: caller must also clear the BFF/browser session and perform Auth0 logout where needed.

## 5. Admin dashboard

### GET /api/v1/admin/dashboard — Admin dashboard summary

- Authentication/permission: Admin client + MFA and admin.dashboard.view.

- Request: no body.

- Success: 200; data contains user/system aggregate summaries and recent Admin activity built from shared database records.

- Errors: 401/403; dashboard permission does not grant access to the underlying user or audit detail APIs.

## 6. User dashboard

### GET /api/v1/dashboard — Signed-in user landing summary

- Authentication: active signed-in user.

- Request: no body.

- Success: 200; data contains user/profile/account summary and a navigation[] list derived from current permissions.

- Limit: navigation is informational; each route performs its own authorization.

## 7. User and account lifecycle

### GET /api/v1/users and GET /api/v1/admin/users — Search users

- Permission: admin.users.view; Admin alias also requires Admin client/MFA.

- Query: page, page_size, user_id, status, search, name, email, mobile_number, role_code, email_verified, mobile_verified, created_from, created_to.

- Success: 200; data[] includes id, email, names, phone_e164, status, verification booleans, effective role codes and created_at; pagination is in meta.

- Errors: 400 invalid query/pagination; 409 invalid_user_date_range; 403 missing permission.

### GET /api/v1/users/:id and GET /api/v1/admin/users/:id — User detail

- Permission: admin.users.view; Admin alias also requires Admin client/MFA.

- Request: path id (UUID).

- Success: 200; data contains identity/status/security lifecycle fields, profile, effective roles and timestamps. Secrets are not returned.

- Errors: 400 malformed UUID; 404 user_not_found; 403 missing permission.

### PATCH /api/v1/users/:id — Update approved profile fields

- Access: owner may update self; updating another user requires user.update.

- Request body: at least one approved field; all fields optional individually:

```
{
"first_name": "Aarav",
"last_name": "Sharma",
"display_name": "Aarav Sharma",
"locale": "en-IN",
"timezone": "Asia/Kolkata"
}
```

- Success: 200; data has id, first_name, last_name, and updated profile.

- Errors: 400 invalid fields; 403 owner/permission check; 409 empty_update.

### GET/PATCH /api/v1/users/:id/preferences — Own preferences

- Access: own internal user ID only; no Admin-wide preference access.

- GET request: no body. GET success: 200; data includes user_id, locale/language/timezone, profile preferences and transactional/marketing email booleans.

- PATCH body: any non-empty combination of transactional_email_enabled, marketing_email_enabled, locale, language, timezone.

```
{
"transactional_email_enabled": true,
"marketing_email_enabled": false
}
```

- PATCH success: 200; data includes user_id, updated locale/language/timezone and email-preference booleans.

- Errors: 400 invalid fields; 403 path ID is not the authenticated user; 404 unknown user; 409 empty_update.

### POST /api/v1/users/:id/disable and POST /api/v1/users/:id/enable

- Permission: admin.users.status.update; Admin client/MFA is required for admin context.

- Request body: status must match the route (DISABLED for disable, ACTIVE for enable), plus a mandatory reason (5–1000 characters).

- Success: 201; data contains user id and resulting status (or unchanged: true).

- Errors: 400 invalid status/body; 403 insufficient permission or self-change; 404 unknown user; 409 invalid transition.

### PATCH /api/v1/admin/users/:id/status — Change account status

- Permission: admin.users.status.update + Admin client/MFA.

- Request body: status is ACTIVE, DISABLED or SUSPENDED; reason is required (5–1000 chars). For SUSPENDED, suspension_category is required: ROUTINE, SECURITY, FRAUD, LEGAL, INVESTIGATION.

- Success: 200; data includes id and resulting status.

- Errors: 400 invalid fields; 403 permission/self-change; 409 missing suspension category/invalid transition.

### POST /api/v1/admin/users/:id/lock — Lock account

- Permission: admin.users.lock + Admin client/MFA.

- Body: { "reason": "...", "locked_until": "2026-11-05T09:00:00.000Z" }; locked_until optional, reason mandatory (5–1000 chars).

- Success: 201; data contains id, status: "LOCKED", locked_at, locked_until.

- Errors: 400 invalid fields; 403 permission/self-change; 404 unknown user; 409 invalid transition.

### POST /api/v1/admin/users/:id/unlock — Unlock account

- Permission: admin.users.unlock + Admin client/MFA.

- Body: mandatory reason (5–1000 chars).

- Success: 201; data contains id, resulting status and unlocked_by.

- Errors: 400, 403, 404 or 409 based on validation, authorization and current state.

### POST /api/v1/admin/users/:id/reinstate — Reinstate/request reinstatement

- Permission: admin.users.reinstate + Admin client/MFA.

- Body: { "reason": "..." }; 10–1000 characters.

- Success: 201; direct reinstatement returns id, status: "ACTIVE", reinstated_by, and reinstatement_status: "REINSTATED". Restricted ADMIN requests return status: "SUSPENDED", reinstatement_status: "PENDING_APPROVAL", and request_audit_id.

- Errors: 400, 403 permission/self-reinstatement; 404; 409 invalid account state or restricted policy.

### POST /api/v1/admin/users/:id/reinstate/approve — Approve restricted request

- Permission: admin.users.reinstate + Admin client/MFA; actor must be SUPER_ADMIN and not the requester.

- Body: request_audit_id (UUID) and mandatory approval_reason (10–1000 chars).

- Success: 201; data includes id, status: "ACTIVE", reinstatement_status: "REINSTATED", approver_user_id.

- Errors: 400 invalid body; 403 actor/policy denied; 404 invalid request/target; 409 already decided or invalid state.

### POST /api/v1/admin/users/:id/reinstate/reject — Reject restricted request

- Permission: admin.users.reinstate + Admin client/MFA; SUPER_ADMIN decision.

- Body: request_audit_id (UUID) and rejection_reason (10–1000 chars).

- Success: 201; data includes id, status: "SUSPENDED", reinstatement_status: "REJECTED", request_audit_id.

- Errors: 400, 403, 404 or 409 for invalid request/state.

### GET /api/v1/users/:id/roles and GET /api/v1/admin/users/:id/roles

- Permission: admin.roles.view + Admin client/MFA for Admin alias.

- Success: 200; data[] contains role ID/code/name, assignment status, starts/ends and revoked time.

- Errors: 400 UUID; 403; 404 user_not_found.

### POST /api/v1/users/:id/roles and POST /api/v1/admin/users/:id/roles

- Permission: admin.roles.assign + Admin client/MFA for Admin alias.

- Body: role_id UUID, mandatory reason (5–500 chars), optional ISO starts_at/ends_at.

```
{
"role_id": "00000000-0000-4000-8000-000000000002",
"reason": "Approved access for the support rotation"
}
```

- Success: 201; data contains assignment id, role_id, status (or unchanged: true).

- Errors: 400, 403 role/permission/self-assignment protection, 404 user/role, 409 invalid range/state.

### DELETE /api/v1/users/:id/roles/:roleId and Admin alias

- Permission: admin.roles.revoke + Admin client/MFA for Admin alias.

- Body: { "reason": "Role no longer required" }; reason required (5–500 chars).

- Success: 200; data contains assignment id and status: "REVOKED" (or unchanged: true). This revokes the assignment; it does not delete the user or role.

- Errors: 400, 403, 404, 409.

## 8. Role and permission management

### GET /api/v1/roles and GET /api/v1/admin/roles — List roles

- Permission: admin.roles.view; Admin alias requires Admin client/MFA.

- Query: page, page_size (maximum 100).

- Success: 200; data[] contains active role records and pagination metadata.

### GET /api/v1/roles/:id and Admin alias — Role detail

- Permission: admin.roles.view.

- Success: 200; data includes role definition, permissions and available assignment-history information.

- Errors: 400 invalid UUID; 403; 404 role_not_found.

### GET /api/v1/permissions and Admin alias — Permission catalogue

- Permission: admin.permissions.view.

- Query: page, page_size (maximum 100).

- Success: 200; data[] contains permission definition fields including code/module/resource/action; pagination in meta.

### GET /api/v1/roles/:id/permissions and Admin alias — Role mapping read

- Permission: admin.roles.view.

- Success: 200; data[] contains active permission definitions currently mapped to the role.

### PUT /api/v1/roles/:id/permissions and Admin alias — Replace role permission mapping

- Permission: admin.roles.permissions.manage.

- Body: permission_ids array of UUIDs and mandatory reason (5–500 characters). Caller may not delegate a permission it does not hold. System role mappings are protected.

```
{
"permission_ids": ["00000000-0000-4000-8000-000000000003"]
}
```

- Success: 200; data contains role_id, resulting permission_ids, or unchanged: true.

- Errors: 400 invalid IDs/body; 403 insufficient authority/system role; 404 role/permission; 409 policy conflict.

## 9. Audit

### GET /api/v1/audit-logs and GET /api/v1/admin/audit-logs — Search events

- Permission: admin.audit.view; Admin alias requires Admin client/MFA.

- Query: actor_user_id, target_user_id, action, resource_type, resource_id, result (SUCCESS/FAILURE), from, to, page, page_size.

- Success: 200; data[] contains immutable audit events; pagination in meta.

- Errors: 400 malformed filters/date range; 403 missing permission.

### GET /api/v1/audit-logs/:id and Admin alias — Audit detail

- Permission: admin.audit.view.

- Success: 200; data contains one audit event including recorded actor/action/resource/result/metadata/request context.

- Errors: 400 invalid UUID; 403; 404 unknown audit ID.

## 10. Configuration and feature flags

### GET /api/v1/configurations and GET /api/v1/admin/settings — List settings

- Permission: admin.settings.view.

- Query: page, page_size (maximum 100).

- Success: 200; data[] contains active setting definitions grouped by category; sensitive values are redacted; pagination in meta.

### GET /api/v1/configurations/:key and Admin settings alias — Setting detail

- Permission: admin.settings.view.

- Success: 200; data contains approved setting metadata, value if non-sensitive, status and version.

- Errors: 403; 404 unknown setting key.

### PUT /api/v1/configurations/:key — Legacy setting update

- Permission: admin.settings.update.

- Body: value, mandatory expected_version (integer >=1), and reason (required by current implementation).

- Success: 200; data contains updated setting metadata/value and incremented version.

- Errors: 400 schema/reason/version validation; 403; 404; 409 stale version or non-editable setting.

### PATCH /api/v1/admin/settings/:key — Admin setting update

- Permission: admin.settings.update + Admin client/MFA.

- Body: same versioned setting DTO: value, expected_version, reason.

- Success: 200; updated setting in data with incremented version.

### PATCH /api/v1/admin/settings/:key/status — Activate/deactivate setting

- Permission: admin.settings.update + Admin client/MFA.

- Body: { "status": "ACTIVE", "expected_version": 1, "reason": "..." }.

- Success: 200; updated setting in data, new version.

### GET /api/v1/feature-flags and Admin alias — List feature flags

- Permission: admin.feature_flags.view.

- Query: page, page_size (maximum 100).

- Success: 200; data[] includes flag name/key, enabled/effective state, status and version; pagination in meta.

### GET /api/v1/feature-flags/:key and Admin alias — Flag detail

- Permission: admin.feature_flags.view.

- Success: 200; data contains registered flag and effective state/version.

### PUT /api/v1/feature-flags/:key — Legacy feature flag update

- Permission: admin.feature_flags.update.

- Body: enabled boolean, current expected_version, mandatory reason.

- Success: 200; updated flag in data with incremented version.

### PATCH /api/v1/admin/feature-flags/:key — Admin feature flag update

- Permission: admin.feature_flags.update + Admin client/MFA.

- Body: enabled boolean, current expected_version, mandatory reason.

- Success: 200; updated flag in data.

### PATCH /api/v1/admin/feature-flags/:key/status — Activate/deactivate flag definition

- Permission: admin.feature_flags.update + Admin client/MFA.

- Body: { "status": "ACTIVE", "expected_version": 1, "reason": "..." }.

- Success: 200; updated flag in data, incremented version.

- Errors for writes: 400 invalid value/missing reason/version; 403; 404; 409 stale version/inactive policy.

## 11. API sessions

These APIs manage Examinity API-token sessions observed by this backend. They do not terminate Auth0 SSO or a browser/BFF session. Session ownership always comes from the validated principal.

### GET /api/v1/auth/me/sessions — List own user sessions

- Access: active signed-in user; own sessions only.

- Success: 200; data[] contains session ID, status, current marker, best-effort device/browser/IP, login/last activity/expiry/revocation metadata; meta.current_session_id.

### GET /api/v1/auth/me/sessions/:sessionId — Read own user session

- Access: active signed-in user; own session only.

- Success: 200; data contains the selected session's safe details.

- Errors: 400 invalid UUID; 404 session_not_found (including foreign owner).

### DELETE /api/v1/auth/me/sessions/:sessionId — Revoke own user session

- Access: active signed-in user; own session only.

- Success: 200; { "id": "...", "status": "REVOKED", "unchanged": false }.

- Errors: 404; 409 session_expired.

### POST /api/v1/auth/me/sessions/revoke-others — Revoke other user sessions

- Access: active signed-in user; current session is retained.

- Body: { "confirmation": true }.

- Success: 200; { "revoked_count": 1, "current_session_id": "..." }.

- Errors: 409 current_session_unavailable if current token cannot be identified.

### Admin session aliases

The following Admin paths use the same session service and only affect the signed-in administrator's sessions. They require Admin client/MFA and the named permission:

| **Method and path**                    | **Permission**        | **Success data**                       |
| -------------------------------------- | --------------------- | -------------------------------------- |
| GET /api/v1/me/sessions                | admin.sessions.view   | Session array; meta.current_session_id |
| GET /api/v1/me/sessions/:sessionId     | admin.sessions.view   | One session detail                     |
| DELETE /api/v1/me/sessions/:sessionId  | admin.sessions.revoke | Revoked ID/status/unchanged            |
| POST /api/v1/me/sessions/revoke-others | admin.sessions.revoke | Revoked count/current session ID       |

## 12. Media

### POST /api/v1/media/presign — Create pending upload and presigned URL

- Permission: media.upload and owner is the signed-in principal.

- Headers: required Idempotency-Key.

- Body: original_filename, mime_type (image/jpeg, image/png, image/webp, application/pdf), file_size_bytes (1–104857600), optional visibility (PRIVATE/PUBLIC).

```
{
"original_filename": "sample.pdf",
"mime_type": "application/pdf",
"file_size_bytes": 12345,
"visibility": "PRIVATE"
}
```

- Success: 201; data contains media_id, asset state and short-lived upload_url/upload metadata.

- Errors: 400 unsupported MIME/size/metadata; 403; 409 idempotency conflict; 503 storage is not configured.

### POST /api/v1/media/:id/complete — Confirm upload

- Permission: media.upload; owner check.

- Request: UUID path; no body.

- Success: 201; data contains asset id and status: "AVAILABLE" (or unchanged when already complete).

- Errors: 400 malformed UUID/object metadata; 403; 404; 409 invalid asset state.

### GET /api/v1/media/:id — Read media metadata

- Permission: media.read; ownership/visibility check.

- Success: 200; data contains safe metadata, status and visibility; no binary content.

### GET /api/v1/media/:id/download-url — Create short-lived download URL

- Permission: media.download; ownership/visibility check.

- Success: 200; { "download_url": "<short-lived-url>", "expires_in_seconds": 60 }.

- Errors: 403, 404, 409 unavailable/deleted asset, 503 storage unavailable.

### DELETE /api/v1/media/:id — Soft-delete asset

- Permission: media.delete; owner policy.

- Success: 200; data contains asset ID/status.

- Limit: object removal is a storage lifecycle/operations task.

## 13. Provider callback

### POST /api/v1/auth/phone/deliver — Auth0 phone delivery callback

- Authentication: configured provider bearer secret, not user/admin token.

- Body: recipient, provider-generated code, message type and locale; only supported validated message types are accepted.

- Success: 201; data reports delivery outcome/channel. Auth0 remains responsible for OTP verification and token issuance; callback audits success/failure.

- Limit: requires provider integration credentials and explicit scope approval. Do not enable by copying local demo values. This callback is not a general user OTP verification endpoint.

## 14. Shared response and error schemas

All successful responses are wrapped by the global response interceptor. Example paginated result:

```
{
"data": [{ "id": "<uuid>", "status": "ACTIVE" }],
"meta": {
"page": 1,
"page_size": 20,
"total": 1,
"total_pages": 1,
"request_id": "<request-id>"
}
}
```

All errors are normalized by the global exception filter. request_id is echoed in the body and X-Request-ID header. Server stack traces, SQL, credentials, provider secrets and JWT values are not returned.

## 15. Known contract documentation limitations

The live OpenAPI document currently enumerates 70 operations and input DTO schemas, but does not attach typed success response schemas to most/all operations. This reference documents the common envelope and response data shapes from the current service implementations. The response examples above are representative contracts, not captured production responses. Confirm any fields consumed by a production client against the current API behavior before freezing a public contract. A follow-up improvement is to add response DTOs/ApiResponse schemas to controllers, then regenerate this reference directly from the enriched OpenAPI document.

The OpenAPI user-list query advertises LOCKED as a status filter, while ListUsersDto validation currently accepts only PENDING, ACTIVE, SUSPENDED and DISABLED. Until the DTO and OpenAPI are reconciled, do not rely on filtering the user list by LOCKED.

This catalog is a technical contract reference, not a claim that external integrations or a production deployment have been verified. See the client overview acceptance items and Postman QA runbook.

## 16. Complete route-level operation catalog

This register is generated from the running OpenAPI document on 4 November 2026. It lists every HTTP operation, not just a screen-level workflow. Request inputs and DTO fields come from the OpenAPI request models. Success statuses and data summaries are reconciled with the current NestJS handlers/services. All successful payloads use the common envelope in section 1.

### 16.1 Complete endpoint index

| **#** | **Method** | **Endpoint**                               | **Operation**                                                                       | **Access**                                                     |
| ----- | ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | GET        | /health/live                               | Process liveness                                                                    | Public; no bearer token                                        |
| 2     | GET        | /health/ready                              | API and database readiness                                                          | Public; no bearer token                                        |
| 3     | GET        | /api/v1/auth/me                            | Resolve the authenticated identity to an active Examinity user and effective roles  | Validated Auth0 API access token                               |
| 4     | POST       | /api/v1/auth/sync                          | Create or refresh the current user's local application profile from Auth0 claims    | Validated Auth0 API access token                               |
| 5     | POST       | /api/v1/auth/logout                        | Revoke the current Examinity API token session and record logout                    | Validated Auth0 API access token                               |
| 6     | POST       | /api/v1/auth/phone/deliver                 | Deliver an Auth0-generated OTP over WhatsApp, falling back to SMS                   | Provider bearer secret; PHONE_PROVIDER_API_SECRET              |
| 7     | GET        | /api/v1/audit-logs                         | Search immutable administrative and security audit events                           | admin.audit.view; Admin client and MFA                         |
| 8     | GET        | /api/v1/admin/audit-logs                   | Search immutable administrative and security audit events                           | admin.audit.view; Admin client and MFA                         |
| 9     | GET        | /api/v1/audit-logs/{id}                    | Get one immutable audit event                                                       | admin.audit.view; Admin client and MFA                         |
| 10    | GET        | /api/v1/admin/audit-logs/{id}              | Get one immutable audit event                                                       | admin.audit.view; Admin client and MFA                         |
| 11    | GET        | /api/v1/users                              | List application users; requires admin.users.view                                   | admin.users.view; Admin client and MFA                         |
| 12    | GET        | /api/v1/admin/users                        | List application users; requires admin.users.view                                   | admin.users.view; Admin client and MFA                         |
| 13    | GET        | /api/v1/users/{id}                         | Get a user and profile by internal Examinity UUID                                   | admin.users.view; Admin client and MFA                         |
| 14    | PATCH      | /api/v1/users/{id}                         | Update approved profile fields for self or an authorized user                       | Own profile; other-user update requires user.update            |
| 15    | GET        | /api/v1/admin/users/{id}                   | Get a user and profile by internal Examinity UUID                                   | admin.users.view; Admin client and MFA                         |
| 16    | GET        | /api/v1/users/{id}/preferences             | Read own notification preferences; self-service only                                | Own authenticated user only                                    |
| 17    | PATCH      | /api/v1/users/{id}/preferences             | Update own transactional/marketing email preferences; self-service only and audited | Own authenticated user only                                    |
| 18    | POST       | /api/v1/users/{id}/disable                 | Disable an Examinity application account                                            | admin.users.status.update; Admin client and MFA                |
| 19    | POST       | /api/v1/users/{id}/enable                  | Enable an Examinity application account                                             | admin.users.status.update; Admin client and MFA                |
| 20    | GET        | /api/v1/users/{id}/roles                   | List a user's role assignments                                                      | admin.roles.view; Admin client and MFA                         |
| 21    | POST       | /api/v1/users/{id}/roles                   | Assign an existing application role                                                 | admin.roles.assign; Admin client and MFA                       |
| 22    | GET        | /api/v1/admin/users/{id}/roles             | List a user's role assignments                                                      | admin.roles.view; Admin client and MFA                         |
| 23    | POST       | /api/v1/admin/users/{id}/roles             | Assign an existing application role                                                 | admin.roles.assign; Admin client and MFA                       |
| 24    | DELETE     | /api/v1/users/{id}/roles/{roleId}          | Remove an application role assignment                                               | admin.roles.revoke; Admin client and MFA                       |
| 25    | DELETE     | /api/v1/admin/users/{id}/roles/{roleId}    | Remove an application role assignment                                               | admin.roles.revoke; Admin client and MFA                       |
| 26    | PATCH      | /api/v1/admin/users/{id}/status            | Update an application account status (ACTIVE / DISABLED / SUSPENDED)                | admin.users.status.update; Admin client and MFA                |
| 27    | POST       | /api/v1/admin/users/{id}/lock              | Lock an account through the shared Module 1 lifecycle (D8)                          | admin.users.lock; Admin client and MFA                         |
| 28    | POST       | /api/v1/admin/users/{id}/reinstate         | Reinstate a SUSPENDED account (D2 — account reinstatement policy)                   | admin.users.reinstate; Admin client and MFA                    |
| 29    | POST       | /api/v1/admin/users/{id}/reinstate/approve | Approve a restricted account reinstatement request (SUPER_ADMIN only, D2)           | admin.users.reinstate; Admin client and MFA                    |
| 30    | POST       | /api/v1/admin/users/{id}/reinstate/reject  | Reject a restricted account reinstatement request (SUPER_ADMIN only, D2)            | admin.users.reinstate; Admin client and MFA                    |
| 31    | POST       | /api/v1/admin/users/{id}/unlock            | Unlock a LOCKED account (D8 — account lock / unlock policy)                         | admin.users.unlock; Admin client and MFA                       |
| 32    | GET        | /api/v1/roles                              | List active application roles                                                       | admin.roles.view; Admin client and MFA                         |
| 33    | GET        | /api/v1/admin/roles                        | List active application roles                                                       | admin.roles.view; Admin client and MFA                         |
| 34    | GET        | /api/v1/roles/{id}                         | Get an application role and its permissions                                         | admin.roles.view; Admin client and MFA                         |
| 35    | GET        | /api/v1/admin/roles/{id}                   | Get an application role and its permissions                                         | admin.roles.view; Admin client and MFA                         |
| 36    | GET        | /api/v1/permissions                        | List registered active permission definitions                                       | admin.permissions.view; Admin client and MFA                   |
| 37    | GET        | /api/v1/admin/permissions                  | List registered active permission definitions                                       | admin.permissions.view; Admin client and MFA                   |
| 38    | GET        | /api/v1/roles/{id}/permissions             | List permissions assigned to a role                                                 | admin.permissions.view; Admin client and MFA                   |
| 39    | PUT        | /api/v1/roles/{id}/permissions             | Replace permissions on a non-system role                                            | admin.permissions.view; Admin client and MFA                   |
| 40    | GET        | /api/v1/admin/roles/{id}/permissions       | List permissions assigned to a role                                                 | admin.roles.view; Admin client and MFA                         |
| 41    | PUT        | /api/v1/admin/roles/{id}/permissions       | Replace permissions on a non-system role                                            | admin.roles.permissions.manage; Admin client and MFA           |
| 42    | GET        | /api/v1/configurations                     | List ACTIVE platform settings                                                       | admin.settings.view; Admin client and MFA                      |
| 43    | GET        | /api/v1/admin/settings                     | List ACTIVE platform settings                                                       | admin.settings.view; Admin client and MFA                      |
| 44    | GET        | /api/v1/configurations/{key}               | Read one platform setting by key                                                    | admin.settings.view; Admin client and MFA                      |
| 45    | PUT        | /api/v1/configurations/{key}               | Create/update an allowlisted setting with optimistic concurrency (legacy PUT)       | admin.settings.update; Admin client and MFA                    |
| 46    | GET        | /api/v1/admin/settings/{key}               | Read one platform setting by key                                                    | admin.settings.view; Admin client and MFA                      |
| 47    | PATCH      | /api/v1/admin/settings/{key}               | Update an approved platform setting (D4, D6)                                        | admin.settings.update; Admin client and MFA                    |
| 48    | PATCH      | /api/v1/admin/settings/{key}/status        | Activate or deactivate a setting definition with optimistic locking (D4)            | admin.settings.update; Admin client and MFA                    |
| 49    | GET        | /api/v1/feature-flags                      | List registered feature flags                                                       | admin.feature_flags.view; Admin client and MFA                 |
| 50    | GET        | /api/v1/admin/feature-flags                | List registered feature flags                                                       | admin.feature_flags.view; Admin client and MFA                 |
| 51    | GET        | /api/v1/feature-flags/{key}                | Read one registered feature flag                                                    | admin.feature_flags.view; Admin client and MFA                 |
| 52    | PUT        | /api/v1/feature-flags/{key}                | Change a registered feature flag (legacy PUT)                                       | admin.feature_flags.update; Admin client and MFA               |
| 53    | GET        | /api/v1/admin/feature-flags/{key}          | Read one registered feature flag                                                    | admin.feature_flags.view; Admin client and MFA                 |
| 54    | PATCH      | /api/v1/admin/feature-flags/{key}          | Update a feature flag (D5)                                                          | admin.feature_flags.update; Admin client and MFA               |
| 55    | PATCH      | /api/v1/admin/feature-flags/{key}/status   | Activate or deactivate a feature flag with optimistic locking (D5)                  | admin.feature_flags.update; Admin client and MFA               |
| 56    | POST       | /api/v1/media/presign                      | Create a short-lived S3-compatible upload URL and pending asset                     | media.upload; asset owner                                      |
| 57    | POST       | /api/v1/media/{id}/complete                | Validate an uploaded object and mark the asset available                            | media.upload; asset owner                                      |
| 58    | GET        | /api/v1/media/{id}                         | Get available media metadata after ownership checks                                 | media.read; asset owner/visibility rules                       |
| 59    | DELETE     | /api/v1/media/{id}                         | Soft-delete a media asset; storage lifecycle cleanup is an ops task                 | media.delete; asset owner                                      |
| 60    | GET        | /api/v1/media/{id}/download-url            | Generate a short-lived authorized media download URL                                | media.download; owner/visibility rules                         |
| 61    | GET        | /api/v1/dashboard                          | Get the authenticated user's Module 1 dashboard summary                             | Authenticated active user                                      |
| 62    | GET        | /api/v1/admin/dashboard                    | Get an administrator dashboard summary from shared platform records                 | admin.dashboard.view; Admin client and MFA                     |
| 63    | GET        | /api/v1/me/sessions                        | List the signed-in administrator's Examinity API sessions                           | admin.sessions.view; Admin client and MFA; own sessions only   |
| 64    | GET        | /api/v1/me/sessions/{sessionId}            | Read one session owned by the signed-in administrator                               | admin.sessions.view; Admin client and MFA; own sessions only   |
| 65    | DELETE     | /api/v1/me/sessions/{sessionId}            | Revoke one of the signed-in administrator's API sessions                            | admin.sessions.revoke; Admin client and MFA; own sessions only |
| 66    | POST       | /api/v1/me/sessions/revoke-others          | Revoke all other API sessions and preserve the current session                      | admin.sessions.revoke; Admin client and MFA; own sessions only |
| 67    | GET        | /api/v1/auth/me/sessions                   | List the signed-in user's Examinity API sessions                                    | Authenticated active user; own sessions only                   |
| 68    | GET        | /api/v1/auth/me/sessions/{sessionId}       | Read one session owned by the signed-in user                                        | Authenticated active user; own sessions only                   |
| 69    | DELETE     | /api/v1/auth/me/sessions/{sessionId}       | Revoke one API session owned by the signed-in user                                  | Authenticated active user; own sessions only                   |
| 70    | POST       | /api/v1/auth/me/sessions/revoke-others     | Revoke all of the signed-in user's other API sessions                               | Authenticated active user; own sessions only                   |

### 16.2 Endpoint request and response details

#### GET /health/live — Process liveness

- Access: Public; no bearer token.

- Request body: none.

- Success: HTTP 200; data: Object: status=ok.

- OpenAPI-declared response codes: 200.

#### GET /health/ready — API and database readiness

- Access: Public; no bearer token.

- Request body: none.

- Success: HTTP 200; data: Object: status=ready.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/auth/me — Resolve the authenticated identity to an active Examinity user and effective roles

- Access: Validated Auth0 API access token.

- Behavior: No request body. Click Authorize and provide an Auth0 API access token; the user identity comes from its verified claims.

- Request body: none.

- Success: HTTP 200; data: Object: user, roles[], permissions[].

- OpenAPI-declared response codes: 403.

#### POST /api/v1/auth/sync — Create or refresh the current user's local application profile from Auth0 claims

- Access: Validated Auth0 API access token.

- Behavior: Provide an Auth0 API access token. First provisioning requires terms_accepted, the current terms_version, and registration_source (EMAIL, PHONE, or SOCIAL). Unverified identities are stored as PENDING with no roles.

- JSON request body: optional by OpenAPI.

- Fields: terms_accepted (boolean, optional); terms_version (string, optional); registration_source (string, optional; values: EMAIL, PHONE, SOCIAL)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"terms_accepted":  true,
"terms_version":  "v1",
"registration_source":  "EMAIL"
}
```

- Success: HTTP 200; data: Object: user, roles[], permissions[].

- OpenAPI-declared response codes: 200.

#### POST /api/v1/auth/logout — Revoke the current Examinity API token session and record logout

- Access: Validated Auth0 API access token.

- Behavior: Revokes this API token for future requests. The client must also clear its browser/BFF session and perform any required Auth0 logout.

- Request body: none.

- Success: HTTP 201; data: Object: recorded boolean; API session is revoked.

- OpenAPI-declared response codes: 201.

#### POST /api/v1/auth/phone/deliver — Deliver an Auth0-generated OTP over WhatsApp, falling back to SMS

- Access: Provider bearer secret; PHONE_PROVIDER_API_SECRET.

- Behavior: Provider callback only. Auth0 retains and verifies the OTP and issues tokens; this endpoint never stores the code.

- JSON request body: required.

- Fields: recipient (string, required); code (string, required); message_type (string, required; values: otp_enroll, otp_verify); locale (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"recipient":  "+919876543210",
"code":  "123456",
"message_type":  "otp_enroll",
"locale":  "en-IN"
}
```

- Success: HTTP 201; data: Delivery outcome and selected channel; OTP remains Auth0-owned.

- OpenAPI-declared response codes: 201.

#### GET /api/v1/audit-logs — Search immutable administrative and security audit events

- Access: admin.audit.view; Admin client and MFA.

- Query parameters: to, from, result, resource_id, resource_type, action, target_user_id, actor_user_id.

- Request body: none.

- Success: HTTP 200; data: Array of audit events; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/audit-logs — Search immutable administrative and security audit events

- Access: admin.audit.view; Admin client and MFA.

- Query parameters: to, from, result, resource_id, resource_type, action, target_user_id, actor_user_id.

- Request body: none.

- Success: HTTP 200; data: Array of audit events; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/audit-logs/{id} — Get one immutable audit event

- Access: admin.audit.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: One immutable audit event.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/audit-logs/{id} — Get one immutable audit event

- Access: admin.audit.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: One immutable audit event.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/users — List application users; requires admin.users.view

- Access: admin.users.view; Admin client and MFA.

- Query parameters: created_to, created_from, mobile_verified, email_verified, role_code, mobile_number, search, page_size, page, email, name, user_id, status.

- Request body: none.

- Success: HTTP 200; data: Array of user summaries; pagination in meta.

- OpenAPI-declared response codes: 403.

#### GET /api/v1/admin/users — List application users; requires admin.users.view

- Access: admin.users.view; Admin client and MFA.

- Query parameters: created_to, created_from, mobile_verified, email_verified, role_code, mobile_number, search, page_size, page, email, name, user_id, status.

- Request body: none.

- Success: HTTP 200; data: Array of user summaries; pagination in meta.

- OpenAPI-declared response codes: 403.

#### GET /api/v1/users/{id} — Get a user and profile by internal Examinity UUID

- Access: admin.users.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: User identity, verification/status/security fields, profile, effective roles and timestamps.

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/users/{id} — Update approved profile fields for self or an authorized user

- Access: Own profile; other-user update requires user.update.

- Path parameters: id.

- JSON request body: required.

- Fields: first_name (string, optional); last_name (string, optional); display_name (string, optional); locale (string, optional); timezone (string, optional)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"first_name":  "Aarav",
"last_name":  "Sharma",
"display_name":  "Aarav Sharma",
"locale":  "en-IN",
"timezone":  "Asia/Kolkata"
}
```

- Success: HTTP 200; data: Object: id, first_name, last_name and profile.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/users/{id} — Get a user and profile by internal Examinity UUID

- Access: admin.users.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: User identity, verification/status/security fields, profile, effective roles and timestamps.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/users/{id}/preferences — Read own notification preferences; self-service only

- Access: Own authenticated user only.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Object: user_id, locale/language/timezone and email preference booleans.

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/users/{id}/preferences — Update own transactional/marketing email preferences; self-service only and audited

- Access: Own authenticated user only.

- Path parameters: id.

- JSON request body: required.

- Fields: transactional_email_enabled (boolean, optional); marketing_email_enabled (boolean, optional); locale (string, optional); language (string, optional); timezone (string, optional)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"transactional_email_enabled":  true,
"marketing_email_enabled":  false
}
```

- Success: HTTP 200; data: Object: user_id, locale/language/timezone and email preference booleans.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/users/{id}/disable — Disable an Examinity application account

- Access: admin.users.status.update; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: status (string, required; values: ACTIVE, DISABLED, SUSPENDED); reason (string, required); suspension_category (string, optional; values: ROUTINE, SECURITY, FRAUD, LEGAL, INVESTIGATION)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"status":  "DISABLED",
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 201; data: Object: id, resulting status and lifecycle timestamps/actor fields as applicable.

- OpenAPI-declared response codes: 201.

#### POST /api/v1/users/{id}/enable — Enable an Examinity application account

- Access: admin.users.status.update; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: status (string, required; values: ACTIVE, DISABLED, SUSPENDED); reason (string, required); suspension_category (string, optional; values: ROUTINE, SECURITY, FRAUD, LEGAL, INVESTIGATION)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"status":  "ACTIVE",
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 201; data: Object: id, resulting status and lifecycle timestamps/actor fields as applicable.

- OpenAPI-declared response codes: 201.

#### GET /api/v1/users/{id}/roles — List a user's role assignments

- Access: admin.roles.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Array of role assignments.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/users/{id}/roles — Assign an existing application role

- Access: admin.roles.assign; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: role_id (string, required); starts_at (string, optional); ends_at (string, optional); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"role_id":  "00000000-0000-4000-8000-000000000002",
"reason":  "Approved by the support lead"
}
```

- Success: HTTP 201; data: Object: assignment id, role_id and status (or unchanged).

- OpenAPI-declared response codes: 201.

#### GET /api/v1/admin/users/{id}/roles — List a user's role assignments

- Access: admin.roles.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Array of role assignments.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/admin/users/{id}/roles — Assign an existing application role

- Access: admin.roles.assign; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: role_id (string, required); starts_at (string, optional); ends_at (string, optional); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"role_id":  "00000000-0000-4000-8000-000000000002",
"reason":  "Approved by the support lead"
}
```

- Success: HTTP 201; data: Object: assignment id, role_id and status (or unchanged).

- OpenAPI-declared response codes: 201.

#### DELETE /api/v1/users/{id}/roles/{roleId} — Remove an application role assignment

- Access: admin.roles.revoke; Admin client and MFA.

- Path parameters: id, roleId.

- JSON request body: required.

- Fields: reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"reason":  "Role no longer required for this account"
}
```

- Success: HTTP 200; data: Object: assignment id, role_id and status (or unchanged).

- OpenAPI-declared response codes: 200.

#### DELETE /api/v1/admin/users/{id}/roles/{roleId} — Remove an application role assignment

- Access: admin.roles.revoke; Admin client and MFA.

- Path parameters: id, roleId.

- JSON request body: required.

- Fields: reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"reason":  "Role no longer required for this account"
}
```

- Success: HTTP 200; data: Object: assignment id, role_id and status (or unchanged).

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/admin/users/{id}/status — Update an application account status (ACTIVE / DISABLED / SUSPENDED)

- Access: admin.users.status.update; Admin client and MFA.

- Behavior: Requires admin.users.status.update. LOCKED accounts must use POST /admin/users/:id/unlock. SUSPENDED accounts must use POST /admin/users/:id/reinstate.

- Path parameters: id.

- JSON request body: required.

- Fields: status (string, required; values: ACTIVE, DISABLED, SUSPENDED); reason (string, required); suspension_category (string, optional; values: ROUTINE, SECURITY, FRAUD, LEGAL, INVESTIGATION)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"status":  "ACTIVE",
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: Object: id, resulting status and lifecycle timestamps/actor fields as applicable.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/admin/users/{id}/lock — Lock an account through the shared Module 1 lifecycle (D8)

- Access: admin.users.lock; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: reason (string, required); locked_until (string, optional)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 201; data: Object: id, resulting status and lifecycle timestamps/actor fields as applicable.

- OpenAPI-declared response codes: 201.

#### POST /api/v1/admin/users/{id}/reinstate — Reinstate a SUSPENDED account (D2 — account reinstatement policy)

- Access: admin.users.reinstate; Admin client and MFA.

- Behavior: Reinstates a SUSPENDED account to ACTIVE. Requires admin.users.reinstate permission. A mandatory reason must be provided. Self-reinstatement is denied. Security/fraud-flagged suspensions require SUPER_ADMIN authority. Module 1 session invalidation and reinstatement notification are triggered after commit.

- Path parameters: id.

- JSON request body: required.

- Fields: reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"reason":  "Account suspension issue reviewed and resolved. User confirmed identity via support ticket #12345."
}
```

- Success: HTTP 201; data: Object: id, status, reinstatement_status and request/approver fields as applicable.

- OpenAPI-declared response codes: 403, 409.

#### POST /api/v1/admin/users/{id}/reinstate/approve — Approve a restricted account reinstatement request (SUPER_ADMIN only, D2)

- Access: admin.users.reinstate; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: request_audit_id (string, required); approval_reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"request_audit_id":  "00000000-0000-4000-8000-000000000001",
"approval_reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 201; data: Object: id, status, reinstatement_status and request/approver fields as applicable.

- OpenAPI-declared response codes: 201.

#### POST /api/v1/admin/users/{id}/reinstate/reject — Reject a restricted account reinstatement request (SUPER_ADMIN only, D2)

- Access: admin.users.reinstate; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: request_audit_id (string, required); rejection_reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"request_audit_id":  "00000000-0000-4000-8000-000000000001",
"rejection_reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 201; data: Object: id, status, reinstatement_status and request/approver fields as applicable.

- OpenAPI-declared response codes: 201.

#### POST /api/v1/admin/users/{id}/unlock — Unlock a LOCKED account (D8 — account lock / unlock policy)

- Access: admin.users.unlock; Admin client and MFA.

- Behavior: Unlocks a LOCKED account and restores it to ACTIVE status. Requires admin.users.unlock permission. Self-unlock is denied. Auth0 brute-force protection is a separate control; if the lock originated from Auth0 attack-protection, the Auth0 block must also be cleared via DELETE /api/v2/users/:auth0UserId/blocks on the Auth0 Management API. Does not restore previously revoked sessions.

- Path parameters: id.

- JSON request body: required.

- Fields: reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"reason":  "Verified no ongoing security incident. User completed identity verification via support."
}
```

- Success: HTTP 201; data: Object: id, resulting status and lifecycle timestamps/actor fields as applicable.

- OpenAPI-declared response codes: 403, 409.

#### GET /api/v1/roles — List active application roles

- Access: admin.roles.view; Admin client and MFA.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of active role definitions; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/roles — List active application roles

- Access: admin.roles.view; Admin client and MFA.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of active role definitions; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/roles/{id} — Get an application role and its permissions

- Access: admin.roles.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Role definition with permissions and available assignment history.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/roles/{id} — Get an application role and its permissions

- Access: admin.roles.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Role definition with permissions and available assignment history.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/permissions — List registered active permission definitions

- Access: admin.permissions.view; Admin client and MFA.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of permission definitions; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/permissions — List registered active permission definitions

- Access: admin.permissions.view; Admin client and MFA.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of permission definitions; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/roles/{id}/permissions — List permissions assigned to a role

- Access: admin.permissions.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Array of active permission definitions.

- OpenAPI-declared response codes: 200.

#### PUT /api/v1/roles/{id}/permissions — Replace permissions on a non-system role

- Access: admin.permissions.view; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: permission_ids (array, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"permission_ids":  [
"00000000-0000-4000-8000-000000000003",
"00000000-0000-4000-8000-000000000004"
],
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: Object: role_id and permission_ids (or unchanged).

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/roles/{id}/permissions — List permissions assigned to a role

- Access: admin.roles.view; Admin client and MFA.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Array of active permission definitions.

- OpenAPI-declared response codes: 200.

#### PUT /api/v1/admin/roles/{id}/permissions — Replace permissions on a non-system role

- Access: admin.roles.permissions.manage; Admin client and MFA.

- Path parameters: id.

- JSON request body: required.

- Fields: permission_ids (array, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"permission_ids":  [
"00000000-0000-4000-8000-000000000003",
"00000000-0000-4000-8000-000000000004"
],
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: Object: role_id and permission_ids (or unchanged).

- OpenAPI-declared response codes: 200.

#### GET /api/v1/configurations — List ACTIVE platform settings

- Access: admin.settings.view; Admin client and MFA.

- Behavior: Returns paginated ACTIVE settings grouped by category. Sensitive setting values (is_sensitive=true) are redacted in the response (D4). Requires admin.settings.view permission.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of active setting definitions; sensitive values redacted; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/settings — List ACTIVE platform settings

- Access: admin.settings.view; Admin client and MFA.

- Behavior: Returns paginated ACTIVE settings grouped by category. Sensitive setting values (is_sensitive=true) are redacted in the response (D4). Requires admin.settings.view permission.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of active setting definitions; sensitive values redacted; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/configurations/{key} — Read one platform setting by key

- Access: admin.settings.view; Admin client and MFA.

- Behavior: Sensitive values are redacted. Requires admin.settings.view.

- Path parameters: key.

- Request body: none.

- Success: HTTP 200; data: One setting definition/value, status and version; sensitive values redacted.

- OpenAPI-declared response codes: 200.

#### PUT /api/v1/configurations/{key} — Create/update an allowlisted setting with optimistic concurrency (legacy PUT)

- Access: admin.settings.update; Admin client and MFA.

- Path parameters: key.

- JSON request body: required.

- Fields: value (JSON value, required); expected_version (number, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"value":  "en-IN",
"expected_version":  1,
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: One setting definition/value, status and version; sensitive values redacted.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/settings/{key} — Read one platform setting by key

- Access: admin.settings.view; Admin client and MFA.

- Behavior: Sensitive values are redacted. Requires admin.settings.view.

- Path parameters: key.

- Request body: none.

- Success: HTTP 200; data: One setting definition/value, status and version; sensitive values redacted.

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/admin/settings/{key} — Update an approved platform setting (D4, D6)

- Access: admin.settings.update; Admin client and MFA.

- Behavior: Requires admin.settings.update. A mandatory reason is required. Rejected if is_editable=false or status=INACTIVE. Enforces optimistic locking via expected_version. Actual secrets must never be stored in this table — use a secrets manager.

- Path parameters: key.

- JSON request body: required.

- Fields: value (JSON value, required); expected_version (number, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"value":  "en-IN",
"expected_version":  1,
"reason":  "Changing platform default locale to en-IN per stakeholder request."
}
```

- Success: HTTP 200; data: One setting definition/value, status and version; sensitive values redacted.

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/admin/settings/{key}/status — Activate or deactivate a setting definition with optimistic locking (D4)

- Access: admin.settings.update; Admin client and MFA.

- Path parameters: key.

- JSON request body: required.

- Fields: status (string, required; values: ACTIVE, INACTIVE); expected_version (number, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"status":  "ACTIVE",
"expected_version":  1,
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: One setting definition/value, status and version; sensitive values redacted.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/feature-flags — List registered feature flags

- Access: admin.feature_flags.view; Admin client and MFA.

- Behavior: Returns all flags with their effective_enabled state. INACTIVE flags always report effective_enabled=false regardless of the stored enabled value (D5). Requires admin.feature_flags.view.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of registered flags; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/feature-flags — List registered feature flags

- Access: admin.feature_flags.view; Admin client and MFA.

- Behavior: Returns all flags with their effective_enabled state. INACTIVE flags always report effective_enabled=false regardless of the stored enabled value (D5). Requires admin.feature_flags.view.

- Query parameters: page_size, page.

- Request body: none.

- Success: HTTP 200; data: Array of registered flags; pagination in meta.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/feature-flags/{key} — Read one registered feature flag

- Access: admin.feature_flags.view; Admin client and MFA.

- Behavior: Requires admin.feature_flags.view.

- Path parameters: key.

- Request body: none.

- Success: HTTP 200; data: One registered flag with effective state, status and version.

- OpenAPI-declared response codes: 200.

#### PUT /api/v1/feature-flags/{key} — Change a registered feature flag (legacy PUT)

- Access: admin.feature_flags.update; Admin client and MFA.

- Path parameters: key.

- JSON request body: required.

- Fields: enabled (boolean, required); expected_version (number, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"enabled":  true,
"expected_version":  1,
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: One registered flag with effective state, status and version.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/admin/feature-flags/{key} — Read one registered feature flag

- Access: admin.feature_flags.view; Admin client and MFA.

- Behavior: Requires admin.feature_flags.view.

- Path parameters: key.

- Request body: none.

- Success: HTTP 200; data: One registered flag with effective state, status and version.

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/admin/feature-flags/{key} — Update a feature flag (D5)

- Access: admin.feature_flags.update; Admin client and MFA.

- Behavior: Requires admin.feature_flags.update. expected_version is mandatory for optimistic locking. A reason should be supplied for audit trail. INACTIVE flags cannot be toggled — a SUPER_ADMIN must reactivate the flag first.

- Path parameters: key.

- JSON request body: required.

- Fields: enabled (boolean, required); expected_version (number, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"enabled":  true,
"expected_version":  1,
"reason":  "Enabling new dashboard for all users per release plan."
}
```

- Success: HTTP 200; data: One registered flag with effective state, status and version.

- OpenAPI-declared response codes: 200.

#### PATCH /api/v1/admin/feature-flags/{key}/status — Activate or deactivate a feature flag with optimistic locking (D5)

- Access: admin.feature_flags.update; Admin client and MFA.

- Path parameters: key.

- JSON request body: required.

- Fields: status (string, required; values: ACTIVE, INACTIVE); expected_version (number, required); reason (string, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"status":  "ACTIVE",
"expected_version":  1,
"reason":  "Example reason for this reviewed administrative action."
}
```

- Success: HTTP 200; data: One registered flag with effective state, status and version.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/media/presign — Create a short-lived S3-compatible upload URL and pending asset

- Access: media.upload; asset owner.

- Headers: idempotency-key, Idempotency-Key.

- JSON request body: required.

- Fields: original_filename (string, required); mime_type (string, required; values: image/jpeg, image/png, image/webp, application/pdf); file_size_bytes (number, required); visibility (string, optional; values: PRIVATE, PUBLIC)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"original_filename":  "sample.pdf",
"mime_type":  "application/pdf",
"file_size_bytes":  12345,
"visibility":  "PRIVATE"
}
```

- Success: HTTP 201; data: Pending media ID, short-lived upload URL and upload metadata.

- OpenAPI-declared response codes: 201.

#### POST /api/v1/media/{id}/complete — Validate an uploaded object and mark the asset available

- Access: media.upload; asset owner.

- Path parameters: id.

- Request body: none.

- Success: HTTP 201; data: Object: asset id and status.

- OpenAPI-declared response codes: 201.

#### GET /api/v1/media/{id} — Get available media metadata after ownership checks

- Access: media.read; asset owner/visibility rules.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Safe media metadata, status and visibility.

- OpenAPI-declared response codes: 200.

#### DELETE /api/v1/media/{id} — Soft-delete a media asset; storage lifecycle cleanup is an ops task

- Access: media.delete; asset owner.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Object: asset id and status.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/media/{id}/download-url — Generate a short-lived authorized media download URL

- Access: media.download; owner/visibility rules.

- Path parameters: id.

- Request body: none.

- Success: HTTP 200; data: Object: short-lived download_url and expires_in_seconds.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/dashboard — Get the authenticated user's Module 1 dashboard summary

- Access: Authenticated active user.

- Behavior: Returns the current user's profile summary, account status, and navigation links derived from effective permissions. Navigation visibility is informational; every API request still performs its own authentication and authorization checks. No exam-specific analytics are included.

- Request body: none.

- Success: HTTP 200; data: Dashboard summary object. User dashboard includes profile/account and navigation; Admin dashboard includes aggregate users/system/recent activity.

- OpenAPI-declared response codes: 401, 403.

#### GET /api/v1/admin/dashboard — Get an administrator dashboard summary from shared platform records

- Access: admin.dashboard.view; Admin client and MFA.

- Request body: none.

- Success: HTTP 200; data: Dashboard summary object. User dashboard includes profile/account and navigation; Admin dashboard includes aggregate users/system/recent activity.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/me/sessions — List the signed-in administrator's Examinity API sessions

- Access: admin.sessions.view; Admin client and MFA; own sessions only.

- Request body: none.

- Success: HTTP 200; data: Array of own session summaries; meta includes current_session_id.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/me/sessions/{sessionId} — Read one session owned by the signed-in administrator

- Access: admin.sessions.view; Admin client and MFA; own sessions only.

- Path parameters: sessionId.

- Request body: none.

- Success: HTTP 200; data: One safe session summary.

- OpenAPI-declared response codes: 200.

#### DELETE /api/v1/me/sessions/{sessionId} — Revoke one of the signed-in administrator's API sessions

- Access: admin.sessions.revoke; Admin client and MFA; own sessions only.

- Path parameters: sessionId.

- Request body: none.

- Success: HTTP 200; data: Object: id and status=REVOKED, optionally unchanged.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/me/sessions/revoke-others — Revoke all other API sessions and preserve the current session

- Access: admin.sessions.revoke; Admin client and MFA; own sessions only.

- JSON request body: required.

- Fields: confirmation (boolean, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"confirmation":  true
}
```

- Success: HTTP 200; data: Object: revoked_count and current_session_id.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/auth/me/sessions — List the signed-in user's Examinity API sessions

- Access: Authenticated active user; own sessions only.

- Request body: none.

- Success: HTTP 200; data: Array of own session summaries; meta includes current_session_id.

- OpenAPI-declared response codes: 200.

#### GET /api/v1/auth/me/sessions/{sessionId} — Read one session owned by the signed-in user

- Access: Authenticated active user; own sessions only.

- Path parameters: sessionId.

- Request body: none.

- Success: HTTP 200; data: One safe session summary.

- OpenAPI-declared response codes: 200.

#### DELETE /api/v1/auth/me/sessions/{sessionId} — Revoke one API session owned by the signed-in user

- Access: Authenticated active user; own sessions only.

- Path parameters: sessionId.

- Request body: none.

- Success: HTTP 200; data: Object: id and status=REVOKED, optionally unchanged.

- OpenAPI-declared response codes: 200.

#### POST /api/v1/auth/me/sessions/revoke-others — Revoke all of the signed-in user's other API sessions

- Access: Authenticated active user; own sessions only.

- JSON request body: required.

- Fields: confirmation (boolean, required)

- Illustrative request JSON; replace IDs, reasons, and version values with valid current values:

```
{
"confirmation":  true
}
```

- Success: HTTP 200; data: Object: revoked_count and current_session_id.

- OpenAPI-declared response codes: 200.
