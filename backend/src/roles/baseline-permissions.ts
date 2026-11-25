/**
 * Approved platform role codes and Admin Module permission catalogue (D9, D10).
 *
 * Decision rules (D9):
 *  - One centralised permission catalogue across the entire Examinity platform.
 *  - Reuse Module 1 permission codes wherever they already exist.
 *  - New Admin-specific permissions use the `admin.*` namespace only where an
 *    equivalent code does not already exist.
 *  - Codes are globally unique; duplicates are not permitted.
 *  - Backend is the final authorization authority; frontend checks are not security controls.
 *
 * Decision rules (D10):
 *  - Only SUPER_ADMIN, ADMIN, AUTHENTICATED_USER are approved for the initial release.
 *  - CONTENT_ADMIN, REVIEWER, PUBLISHER must NOT be seeded until formally approved.
 */

// ── Approved platform roles (initial release) ─────────────────────────────────
// Only roles approved for the initial Module 1 release are seeded.
// Future workflows must not become assignable merely because a role name appeared
// in a design draft.
export const platformRoleCodes = ["SUPER_ADMIN", "ADMIN", "AUTHENTICATED_USER"] as const;

// ── Admin Module permission catalogue ─────────────────────────────────────────
// Grouped by functional area for readability. Final codes follow the approved
// admin.* naming convention (D9).

/** Dashboard */
export const adminDashboardPermissions = [
  "admin.dashboard.view", // View Admin Dashboard and authorized overview statistics (D11)
] as const;

/** User management */
export const adminUserPermissions = [
  "admin.users.view", // View individual user records and profiles
  "admin.users.search", // Search/filter users
  "admin.users.status.update", // Enable, disable or suspend user accounts
  "admin.users.lock", // Manually lock an account after review (D8)
  "admin.users.reinstate", // Reinstate suspended accounts (D2 — explicit grant only)
  "admin.users.unlock", // Unlock locked accounts (D8 — explicit grant only)
  "admin.users.activity.view", // View user activity
] as const;

/** Session management (ADM-018 — consumes Module 1 shared capability, D1) */
export const adminSessionPermissions = [
  "admin.sessions.view", // View own active sessions
  "admin.sessions.revoke", // Revoke own sessions
] as const;

/** Role management */
export const adminRolePermissions = [
  "admin.roles.view", // View roles
  "admin.roles.create", // Create new roles
  "admin.roles.update", // Update role metadata
  "admin.roles.assign", // Assign roles to users
  "admin.roles.revoke", // Revoke role assignments
  "admin.permissions.view", // View permission definitions
  "admin.roles.permissions.manage", // Manage role-permission mappings
] as const;

/** Audit */
export const adminAuditPermissions = [
  "admin.audit.view", // View audit logs and audit event details
] as const;

/** Platform settings */
export const adminSettingsPermissions = [
  "admin.settings.view", // View platform settings
  "admin.settings.update", // Update permitted settings (subject to is_editable and validation)
] as const;

/** Feature flags */
export const adminFeatureFlagPermissions = [
  "admin.feature_flags.view", // View feature flags
  "admin.feature_flags.update", // Update feature flag enabled state
] as const;

/**
 * Full baseline Admin permission list granted to ADMIN role on initial seed.
 * admin.users.reinstate and admin.users.unlock are intentionally WITHHELD from
 * ADMIN by default — they require explicit grant per D2 and D8.
 */
export const baselineAdminPermissionCodes = [
  ...adminDashboardPermissions,
  "admin.users.view",
  "admin.users.search",
  "admin.users.status.update",
  "admin.users.activity.view",
  "admin.sessions.view",
  "admin.sessions.revoke",
  "admin.roles.view",
  "admin.permissions.view",
  "admin.audit.view",
  "admin.settings.view",
  "admin.feature_flags.view",
] as const;

/**
 * Permissions withheld from ADMIN by default — require explicit authorised grant.
 *
 * admin.users.reinstate  — D2: explicit admin.users.reinstate permission required
 * admin.users.unlock     — D8: explicit admin.users.unlock permission required
 * admin.roles.create     — Privileged; controlled workflow
 * admin.roles.update     — Privileged; controlled workflow
 * admin.roles.assign     — Privileged role assignment
 * admin.roles.revoke     — Privileged role revocation
 * admin.roles.permissions.manage — Controlled permission mapping
 * admin.settings.update  — Controlled settings mutation
 * admin.feature_flags.update — Controlled feature flag mutation
 */
export const withheldAdminPermissionCodes = [
  "admin.users.lock",
  "admin.users.reinstate",
  "admin.users.unlock",
  "admin.roles.create",
  "admin.roles.update",
  "admin.roles.assign",
  "admin.roles.revoke",
  "admin.roles.permissions.manage",
  "admin.settings.update",
  "admin.feature_flags.update",
] as const;

/** All Admin permission codes (baseline + withheld). Used by SUPER_ADMIN seed grant. */
export const allAdminPermissionCodes = [...baselineAdminPermissionCodes, ...withheldAdminPermissionCodes] as const;

/**
 * Module 2 examination-management permissions approved for the initial
 * taxonomy, examination-master and cycle-management API slice. They are
 * granted to SUPER_ADMIN by the normal seed; ADMIN remains least-privilege.
 */
export const examManagementPermissionCodes = [
  "exam.taxonomy.read",
  "exam.taxonomy.manage",
  "exam.authority.manage",
  "exam.catalogue.read",
  "exam.catalogue.create",
  "exam.catalogue.update",
  "exam.catalogue.archive",
  "exam.cycle.read",
  "exam.cycle.manage",
  "exam.events.manage",
  "exam.salary.manage",
  "exam.cutoff.manage",
  "exam.pattern.manage",
] as const;
