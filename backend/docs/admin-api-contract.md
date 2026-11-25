# Admin API integration notes

The admin console uses the shared Module 1 identity, role, permission, configuration, feature-flag, and append-only audit tables. The backend is the only path to PostgreSQL. Admin browser login uses the shared Auth0 tenant and Universal Login through a separate Auth0 application; the frontend owns its route and browser session.

## ER diagram to Prisma naming

The supplied ER diagram is a logical model; several labels map to normalized Module 1 fields/tables rather than literal column names. `users.auth0_user_id` maps to the unique `identity.users.auth0_subject` value from Auth0 `sub`; `account_status` maps to `users.status`; `mobile_verified` maps to `users.phone_verified`. `user_roles` maps to `identity.user_role_assignments`; role protection fields are `system_role` and `is_protected`; permission `module`, `resource`, and `action` are persisted on `identity.permissions`. The diagram's profile/preferences view is split into `identity.user_profiles` and `notification.email_preferences`. Platform settings and feature flags are stored in the `platform` schema; append-only audit events are in `audit.audit_logs`.

## Contract mapping

The PDF's `/api/v1/admin/...` paths are target contracts. These admin paths now resolve to the same shared services and tables as Module 1 routes; the aliases do not create a second data model:

| Admin operation               | API route(s)                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Dashboard summary             | `GET /api/v1/admin/dashboard`                                                |
| User list, filters, details   | `GET /api/v1/admin/users`, `GET /api/v1/admin/users/:userId`                 |
| User status, suspension       | `PATCH /api/v1/admin/users/:userId/status`                                   |
| Lock / unlock account         | `POST /api/v1/admin/users/:userId/lock`, `POST .../:userId/unlock`            |
| Reinstatement                 | `POST /api/v1/admin/users/:userId/reinstate`, `POST .../reinstate/approve`, `POST .../reinstate/reject` |
| User role assignments         | `GET/POST /api/v1/admin/users/:userId/roles`, `DELETE .../:roleId`           |
| Role list and details/history | `GET /api/v1/admin/roles`, `GET /api/v1/admin/roles/:roleId`                 |
| Permission catalogue          | `GET /api/v1/admin/permissions`                                              |
| Role-permission mapping       | `GET/PUT /api/v1/admin/roles/:roleId/permissions`                            |
| Audit search and detail       | `GET /api/v1/admin/audit-logs`, `GET /api/v1/admin/audit-logs/:auditId`      |
| Settings                      | `GET /api/v1/admin/settings`, `GET/PATCH /api/v1/admin/settings/:settingKey`, `PATCH .../:settingKey/status` |
| Feature flags                 | `GET /api/v1/admin/feature-flags`, `GET/PATCH .../:flagKey`, `PATCH .../:flagKey/status`                  |

Administrative endpoints check current PostgreSQL permissions on each request. The API also requires the dedicated admin Auth0 client ID and an MFA marker for permission-protected routes. The ordinary role assignment API cannot assign `SUPER_ADMIN`; first-admin setup remains the guarded bootstrap command. The initial seed contains only `SUPER_ADMIN`, `ADMIN`, and `AUTHENTICATED_USER`.

Setting and feature flag writes require a current `expected_version` and a non-empty `reason`. Setting and flag status can be changed between `ACTIVE` and `INACTIVE` through the status routes; these updates increment the version and record the prior/new status in the shared audit log in the same transaction. Inactive definitions remain visible to authorized administrators for review/reactivation and are not treated as active configuration or enabled features.

User status changes, lock/unlock, reinstatement, role assignment/revocation, role-permission mapping, settings, and feature-flag writes require a meaningful reason. Setting and feature-flag writes also require the current `expected_version`. Role assignment accepts optional start/end timestamps. Role detail includes assignment history from the shared assignment table; reasons and permission-map before/after state are kept in the append-only audit log. Permission-map changes reject grants of permissions the acting administrator does not hold. Audit supports actor, target, action, resource, outcome and date filters. Organization filtering is not applicable because this schema has no organization scope.

Suspension requests require a category (`ROUTINE`, `SECURITY`, `FRAUD`, `LEGAL`, or `INVESTIGATION`) and a reason. Routine suspension can be reinstated by an authorized administrator. Restricted categories create a pending audit-backed request for ADMIN actors; only a SUPER_ADMIN can approve or reject it. Approval records the restriction-clearance timestamp and reactivates the account; rejection leaves it suspended. Both decisions consume the request audit ID once. Self status changes and self reinstatement are denied.

Application lock/unlock stores lock reason, lock timestamps, optional expiry, and unlock time on the shared user record. Lock and successful recovery invalidate tokens issued before `access_valid_after`; an expired lock is released and audited during authorization. This controls Examinity API access. It does not clear Auth0 brute-force protection, and it does not implement the separate My Sessions screen.

## Role visibility and removal policy

`admin.roles.view` grants read access to the role catalogue and user assignment lists. `admin.roles.assign` controls assignment creation; `admin.roles.revoke` controls assignment revocation; `admin.roles.permissions.manage` controls role-permission mapping. The seeded `ADMIN` role currently has only `admin.roles.view` for role administration, so it cannot assign or revoke roles or change mappings by default. `AUTHENTICATED_USER` has no administrative permissions. Only `SUPER_ADMIN` can perform those writes until the client approves a different grant list. The API has no hard-delete route for users or role definitions. `DELETE /api/v1/users/:userId/roles/:roleId` requires a reason and revokes the assignment by changing its status and timestamp, preserving history. Regular-user attempts to revoke assignments or change administrative records must receive 403.

The Prisma schema and committed migrations are the source of truth for deployment tables. Deploy with `pnpm db:deploy` and `pnpm db:seed`; DevOps should not create a parallel admin RBAC schema or apply hand-written production SQL. Existing identity/RBAC tables are shared by Module 1 and the Admin aliases. The client architecture decision says to reuse the centralized audit log and add dedicated history tables only if audit cannot provide reliable history/querying. This implementation records changes in append-only `audit.audit_logs` and keeps assignment state in `identity.user_role_assignments`; no separate admin history tables are currently required. Preserve this decision unless client review identifies a concrete query or retention gap.

Admin setting PATCH requires an allowlisted value, a reason, and the current version. Feature-flag PATCH requires the current version and only changes simple enabled state. These contracts use the same configuration and flag rows as the Module 1 APIs.

## Auth0 setup

Keep the admin console and user application in the same Auth0 tenant, configure a distinct admin application client ID, and require MFA in the shared Universal Login flow for that client. Attach `auth0-admin-mfa-challenge-action.js`, then `auth0-admin-token-claims-action.js`, to the Post-Login flow. They challenge/enroll the admin user and add the namespaced `admin_client_id` and `mfa` claims to the API access token only after MFA completes. Set matching `AUTH0_ADMIN_CLIENT_ID` and `AUTH0_CLAIM_NAMESPACE` values in the API environment. The backend never accepts an ID token as an API bearer token.

The local mock issuer signs equivalent tokens and includes negative fixtures without MFA and from the regular application. Those fixtures validate backend enforcement; they do not simulate Auth0 enrollment or browser-session behavior.

## Remaining shared-session dependency

`GET /api/v1/auth/me` already provides the signed-in administrator's profile and effective permissions, so no separate `/admin/my-profile` endpoint is needed. ADM-018 uses the shared Module 1 token-session service: its `/me/sessions` list/detail/revoke/revoke-others routes operate only on the signed-in administrator's Examinity API sessions and require the dedicated Admin application, MFA, and `admin.sessions.view`/`admin.sessions.revoke`. The bearer token fingerprint is stored (never the token), and revocation blocks later API requests using that token. This does not terminate Auth0 SSO or a browser/BFF session; clients must clear those sessions separately. See the [session API implementation notes](module-1-admin-session-api-gap-analysis.md).
