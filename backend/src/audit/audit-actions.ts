/**
 * Centralised registry of all audit event action codes used across the platform.
 *
 * Rules:
 * - Every security-sensitive or administrative state change MUST use a code from this list.
 * - Codes MUST remain stable after release; they appear in persisted audit records.
 * - Do NOT merge application-log events with audit events (see spec section 79).
 * - Add new codes here before using them; never write raw strings in service code.
 */
export const AuditAction = {
  // ── Authentication & Session ───────────────────────────────────────────────
  /** Auth0 authentication succeeded and the user's local account was resolved. */
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  /** Authentication failed before reaching the application layer. */
  LOGIN_FAILURE: "LOGIN_FAILURE",
  /** Application-level logout event recorded after Auth0 session termination. */
  LOGOUT: "LOGOUT",

  // ── Account Status ─────────────────────────────────────────────────────────
  /** A new Examinity application user record was provisioned from Auth0 claims. */
  USER_CREATED: "USER_CREATED",
  /** Permitted profile fields were updated on a user record. */
  USER_UPDATED: "USER_UPDATED",
  /** An application account was enabled (DISABLED → ACTIVE). */
  ACCOUNT_ENABLED: "ACCOUNT_ENABLED",
  /** An application account was disabled (ACTIVE → DISABLED). */
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  /** An application account was suspended (ACTIVE / LOCKED → SUSPENDED). */
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  /**
   * An application account was locked due to a security policy or authorised administrative action
   * (ACTIVE → LOCKED). Module 1 / Auth0 security controls own this transition.
   */
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  /**
   * A locked account was unlocked through an approved recovery process or by an authorised
   * administrator (LOCKED → ACTIVE). Requires admin.users.unlock permission.
   */
  ACCOUNT_UNLOCKED: "ACCOUNT_UNLOCKED",

  // ── Account Reinstatement ──────────────────────────────────────────────────
  /**
   * An administrator initiated a reinstatement request for a SUSPENDED account.
   * Recorded even when the request requires further approval.
   */
  REINSTATEMENT_REQUESTED: "REINSTATEMENT_REQUESTED",
  /**
   * A SUPER_ADMIN or authorised administrator approved a pending reinstatement request.
   * Captured together with the approver ID and reason.
   */
  REINSTATEMENT_APPROVED: "REINSTATEMENT_APPROVED",
  /**
   * A pending reinstatement request was rejected. Records the rejector, target user, and reason.
   */
  REINSTATEMENT_REJECTED: "REINSTATEMENT_REJECTED",
  /**
   * A suspended account was successfully reinstated to ACTIVE status
   * (SUSPENDED → ACTIVE). Requires admin.users.reinstate permission.
   */
  USER_ACCOUNT_REINSTATED: "USER_ACCOUNT_REINSTATED",

  // ── Role & Permission Management ───────────────────────────────────────────
  /** A role was assigned to a user. */
  ROLE_ASSIGNED: "ROLE_ASSIGNED",
  /** A role assignment was revoked from a user. */
  ROLE_REMOVED: "ROLE_REMOVED",
  /** The set of permissions mapped to a role was changed. */
  PERMISSION_CHANGED: "PERMISSION_CHANGED",

  // ── Platform Configuration ────────────────────────────────────────────────
  /** A platform configuration value was created or updated. */
  CONFIGURATION_CHANGED: "CONFIGURATION_CHANGED",
  /** A feature flag was toggled on or off. */
  FEATURE_FLAG_CHANGED: "FEATURE_FLAG_CHANGED",

  // ── Media ─────────────────────────────────────────────────────────────────
  /** A presigned upload URL was issued for a pending media asset. */
  MEDIA_UPLOAD_REQUESTED: "MEDIA_UPLOAD_REQUESTED",
  /** A media upload was confirmed and the asset marked AVAILABLE. */
  MEDIA_UPLOADED: "MEDIA_UPLOADED",
  /** A media upload was rejected during completion validation. */
  MEDIA_UPLOAD_REJECTED: "MEDIA_UPLOAD_REJECTED",
  /** A media asset was soft-deleted. */
  MEDIA_DELETED: "MEDIA_DELETED",

  // ── Phone OTP Delivery ────────────────────────────────────────────────────
  /** Auth0 Custom Phone Provider callback delivered an OTP via Twilio. */
  PHONE_OTP_DELIVERY: "PHONE_OTP_DELIVERY",

  // ── Sessions ──────────────────────────────────────────────────────────────
  /** An administrator viewed their own active sessions. */
  SESSION_LIST_VIEWED: "SESSION_LIST_VIEWED",
  /** An administrator revoked one of their own sessions. */
  SESSION_REVOKED: "SESSION_REVOKED",
  /** An administrator revoked all their own other sessions (bulk revoke). */
  SESSIONS_REVOKED_OTHERS: "SESSIONS_REVOKED_OTHERS",

  // ── Security ──────────────────────────────────────────────────────────────
  /** A request was denied by the authentication or authorization layer. */
  ACCESS_DENIED: "ACCESS_DENIED",
} as const;

/** Union type of all valid audit action strings. Prefer `AuditAction.*` over raw string literals. */
export type AuditActionCode = (typeof AuditAction)[keyof typeof AuditAction];
