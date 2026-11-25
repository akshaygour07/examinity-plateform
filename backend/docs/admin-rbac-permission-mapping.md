# Admin RBAC permission mapping

Prepared for D9 client review on 2026-11-03 from `src/roles/baseline-permissions.ts`, route guards/controllers, `prisma/seed.ts`, and the isolated local `examinity` database.

## Decision boundary

The API uses one PostgreSQL permission catalogue and resolves current permissions in the backend. The repository seeds the following `admin.*` permissions into that shared catalogue. D9 requires reuse of an existing code when its meaning is equivalent and client approval before creating new records. The local demo database also contains older generic permission codes, but those records are not created by the checked-in migrations or current seed. Their intended meanings and deployment history are not available here, so treat the candidate mappings below as requiring owner review before changing guards or retiring codes.

## Admin permissions and API guards

| Proposed Admin permission | Purpose and guarded API | Existing local candidate | Current disposition |
| --- | --- | --- | --- |
| `admin.dashboard.view` | Admin overview: `GET /admin/dashboard` | `dashboard.read` | Keep separate for now: D11 explicitly requires dedicated Admin dashboard access, independently of user dashboard access. Confirm candidate scope with the Module 1 owner. |
| `admin.users.view` | User list/detail: `GET /admin/users`, `GET /admin/users/:id` | `user.read` | Reconcile whether existing generic reads have the same admin resource scope before inserting/retaining a duplicate. |
| `admin.users.search` | Search/filter `GET /admin/users` | `user.read` | Reconcile whether search is intentionally distinct from generic user read. |
| `admin.users.status.update` | `PATCH /admin/users/:id/status`; Module 1 enable/disable aliases | `user.disable`, `user.enable` | Reconcile status/suspension coverage and whether separate legacy permissions can express the approved policy. |
| `admin.users.lock` | `POST /admin/users/:id/lock` | None found locally | New Admin-specific capability; D9 approval required. |
| `admin.users.reinstate` | `POST /admin/users/:id/reinstate[/approve|/reject]` | None found locally | New restricted workflow capability; D9 approval required. |
| `admin.users.unlock` | `POST /admin/users/:id/unlock` | None found locally | New recovery capability; D9 approval required. |
| `admin.users.activity.view` | Target-user audit activity via `GET /admin/audit-logs` filters | `audit.read` | Reconcile whether scoped user activity can reuse generic audit read without broadening audit access. |
| `admin.sessions.view` | `GET /me/sessions`, `GET /me/sessions/:sessionId` | None found locally | New shared-session capability; routes currently return 503. |
| `admin.sessions.revoke` | `DELETE /me/sessions/:sessionId`, `POST /me/sessions/revoke-others` | None found locally | New shared-session capability; routes currently return 503. |
| `admin.roles.view` | `GET /admin/roles`, role details, role mappings and user role-assignment reads | `role.read`, `user.roles.read` | Reconcile scope before creating/retaining both codes. |
| `admin.roles.create` | Role creation capability (no current create route) | `role.manage` | Reconcile; the current Admin API does not expose role creation. |
| `admin.roles.update` | Role metadata updates (no current update route) | `role.manage` | Reconcile; the current Admin API does not expose role metadata updates. |
| `admin.roles.assign` | `POST /admin/users/:id/roles` | `user.roles.manage` | Reconcile whether the existing assignment permission is equivalent. |
| `admin.roles.revoke` | `DELETE /admin/users/:id/roles/:roleId` | `user.roles.manage` | Reconcile whether the existing assignment permission is equivalent or needs separation. |
| `admin.permissions.view` | `GET /admin/permissions` | `permission.read` | Reconcile scope before creating/retaining both codes. |
| `admin.roles.permissions.manage` | `PUT /admin/roles/:id/permissions` | `role.permissions.manage` | Reconcile scope before creating/retaining both codes. |
| `admin.audit.view` | `GET /admin/audit-logs`, `GET /admin/audit-logs/:id` | `audit.read` | Reconcile whether generic audit access is equivalent to privileged Admin audit access. |
| `admin.settings.view` | `GET /admin/settings`, `GET /admin/settings/:key` | `configuration.read` | Reconcile scope before creating/retaining both codes. |
| `admin.settings.update` | `PATCH /admin/settings/:key[/status]` | `configuration.manage` | Reconcile scope before creating/retaining both codes. |
| `admin.feature_flags.view` | `GET /admin/feature-flags`, `GET /admin/feature-flags/:key` | `feature_flag.read` | Reconcile scope before creating/retaining both codes. |
| `admin.feature_flags.update` | `PATCH /admin/feature-flags/:key[/status]` | `feature_flag.manage` | Reconcile scope before creating/retaining both codes. |

## Current role seed behavior

- `ADMIN` receives the baseline Admin permissions in `baselineAdminPermissionCodes`; reinstatement, lock/unlock, role writes, settings writes, and feature-flag writes are withheld by default.
- `SUPER_ADMIN` receives every seeded Admin permission. Protected system roles and role-permission mappings have additional backend checks.
- `AUTHENTICATED_USER` receives no Admin permission.
- The local demo database currently contains both the current `admin.*` codes and older generic codes (`user.*`, `role.*`, `configuration.*`, `feature_flag.*`, `audit.read`, and `dashboard.read`). The current checked-in seed upserts `admin.*` grants but does not remove historical generic role mappings. Verify the target environment before relying on its effective role permissions.

## Approval needed to close D9

The Module 1 permission owner should confirm, for each candidate above, whether the existing permission has the same meaning and scope, whether the Admin code should be reused or retained as a distinct privilege, and what controlled migration is needed for current role mappings and guards. The current implementation seeds `admin.*`; review this mapping before the next deployment or reseed. This document records the code inspection and candidate mapping, not client approval.
