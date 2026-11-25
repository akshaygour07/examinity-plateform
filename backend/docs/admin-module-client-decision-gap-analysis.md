# Admin Module client-decision implementation status

Reviewed against the supplied Developer Queries Admin Module and Examinity Admin Module Design Guideline Workflow on 2026-11-03. The Admin routes reuse Module 1 identity, account, RBAC, configuration, feature-flag, and append-only audit records.

## Implemented

- **D2 restricted reinstatement:** suspension category, reason, and clearance metadata are stored on the shared user record. Routine suspensions can be reinstated by an authorized administrator. SECURITY, FRAUD, LEGAL, and INVESTIGATION suspensions require a SUPER_ADMIN approval. ADMIN requests, approvals, and rejections reference the shared audit event ID; state and decision audit writes are transactional. Self-reinstatement is denied.
- **D4 settings and D5 feature flags:** status can be changed between ACTIVE and INACTIVE. Writes require a reason and current `expected_version`; value validation uses HTTP 400. Status/value changes are versioned and audited. Inactive definitions remain visible for review and reactivation.
- **D6 setting validation:** editable settings use the backend-owned allowlist and per-setting validators. Clients cannot change the validation rules or metadata, and secrets are excluded from ordinary setting values.
- **D7 auditability:** sensitive user status, lock, reinstatement, role assignment/revocation, role-permission mapping, settings, and feature-flag writes carry a reason and record actor, target, before/after state, and outcome in the shared audit log where applicable. Permission-denied actions are recorded by the authorization layer.
- **D8 application account lock:** the shared user record stores lock reason, lock time, optional expiry, and unlock time. Authorized lock/unlock routes invalidate previously issued Examinity API tokens; an expired application lock is released by the request authorization flow and audited.
- **D10-D11 authorization baseline:** the seed includes only SUPER_ADMIN, ADMIN, and AUTHENTICATED_USER, withholds sensitive ADMIN permissions by default, and protects dashboard access with dedicated `admin.dashboard.view`.
- Postman source collections include the required write fields, current version handling, lifecycle requests, negative authorization checks, and restoration requests for reversible QA changes.

## Approved scope with an implementation gap

### D9 — Permission equivalence review remains open

The backend uses one shared permission table and seeds `admin.*` codes, but inspection found legacy generic permissions in the local demo database that may overlap with the Admin codes. The current seed does not remove historical generic role mappings. The required reuse/create approval is not evidenced in the supplied decision file, so this remains pending Module 1 permission-owner review. See the [Admin RBAC permission mapping](admin-rbac-permission-mapping.md); do not treat that candidate mapping as approval.

### D1 — My Sessions

D1 session list/detail/revoke/revoke-others are implemented as shared Module 1 Examinity API-token sessions, with Admin aliases for ADM-018. Tokens are fingerprinted after validation; revocation blocks future API calls. This does not terminate Auth0 SSO or a BFF/browser session. See the [session API implementation notes](module-1-admin-session-api-gap-analysis.md).

### D8 — Auth0 attack-protection lock synchronization

Application account lock/unlock is implemented. Synchronizing Auth0 brute-force protection is a separate integration requiring approved Management API credentials, scopes, and operational policy. The API documents that an Auth0-side block must also be cleared through Auth0 Management API; it does not silently claim that the application unlock clears Auth0's block.

## Scope constraints

- No extra profile fields for date of birth, gender, or organization data (D3).
- No separate Admin user, RBAC, session, or audit subsystem.
- Existing centralized audit logs remain the audit store; reinstatement requests use their audit IDs as workflow references.
- ADM-018 uses the shared Module 1 token-session capability; no Admin-owned session store was added.
