import { readFile, writeFile } from "node:fs/promises";

const collectionPaths = [
  "postman/Examinity-Module-1-Frozen-API.postman_collection.json",
  "postman/Examinity-Module-1.postman_collection.json",
];

function request(name, method, path, { query, body, bodyRaw, description, tests = [], auth, disabled = false } = {}) {
  const url = `{{baseUrl}}${path}`;
  return {
    name,
    ...(disabled ? { disabled: true } : {}),
    request: {
      method,
      ...(auth ? { auth } : {}),
      ...(description ? { description } : {}),
      header: body || bodyRaw ? [{ key: "Content-Type", value: "application/json" }] : [],
      url: query ? `${url}?${query}` : url,
      ...(body || bodyRaw
        ? { body: { mode: "raw", raw: bodyRaw ?? JSON.stringify(body, null, 2), options: { raw: { language: "json" } } } }
        : {}),
    },
    response: [],
    ...(tests.length ? { event: [{ listen: "test", script: { type: "text/javascript", exec: tests } }] } : {}),
  };
}

const adminFolder = {
  name: "Admin console APIs (client contract)",
  description:
    "Uses shared Module 1 APIs where implemented. ADM-018 has four registered routes that currently return 503 session_api_not_implemented; session management is approved scope but the shared provider is missing. Run with the admin Auth0 application token (MFA completed), or use mockAdminApiAccessToken in the local mock collection.",
  item: [
    request("GET admin dashboard summary", "GET", "/admin/dashboard", {
      description: "Client contract: totals from existing users, roles, settings, feature flags, and recent audit activity.",
      tests: [
        "pm.test('admin dashboard returns 200', () => pm.response.to.have.status(200));",
        "const body = pm.response.json().data;",
        "pm.test('dashboard has user, system, and recent activity summaries', () => { pm.expect(body.users).to.be.an('object'); pm.expect(body.system).to.be.an('object'); pm.expect(body.recent_admin_activity).to.be.an('array'); });",
      ],
    }),
    request("List and filter users", "GET", "/admin/users", {
      query:
        "page=1&page_size=20&search={{userSearch}}&name={{targetUserName}}&email={{targetUserEmail}}&status=ACTIVE&mobile_number={{mobileSearch}}&email_verified=true&mobile_verified=false&role_code=AUTHENTICATED_USER&created_from={{createdFrom}}&created_to={{createdTo}}",
      description:
        "Search supports name/email through search, plus mobile number, account status, verification state, role, and registration date range.",
      tests: ["pm.test('admin user search returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Filter users by ID", "GET", "/admin/users", {
      query: "page=1&page_size=20&user_id={{targetUserId}}",
      tests: [
        "pm.test('user ID filter returns 200', () => pm.response.to.have.status(200));",
        "pm.test('user ID filter returns the selected user', () => pm.expect(pm.response.json().data.some(item => item.id === pm.environment.get('targetUserId'))).to.equal(true));",
      ],
    }),
    request("Filter users by name and email", "GET", "/admin/users", {
      query: "page=1&page_size=20&name={{targetUserName}}&email={{targetUserEmail}}",
      tests: [
        "pm.test('name and email filters return 200', () => pm.response.to.have.status(200));",
        "pm.test('name and email filters find the synced QA user', () => pm.expect(pm.response.json().data.some(item => item.id === pm.environment.get('targetUserId'))).to.equal(true));",
      ],
    }),
    request("Get user details", "GET", "/admin/users/{{targetUserId}}", {
      tests: ["pm.test('admin user detail returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Set user status (DISABLED)", "PATCH", "/admin/users/{{targetUserId}}/status", {
      body: { status: "DISABLED", reason: "Postman user status contract check" },
      tests: ["pm.test('user status update returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Restore user status (ACTIVE)", "PATCH", "/admin/users/{{targetUserId}}/status", {
      body: { status: "ACTIVE", reason: "Restore after Postman status check" },
      tests: ["pm.test('user status restore returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Lock target user", "POST", "/admin/users/{{targetUserId}}/lock", {
      body: { reason: "Postman D8 lock lifecycle check" },
      tests: ["pm.test('account lock returns 201', () => pm.response.to.have.status(201));"],
    }),
    request("Unlock target user", "POST", "/admin/users/{{targetUserId}}/unlock", {
      body: { reason: "Postman D8 recovery check completed" },
      tests: ["pm.test('account unlock returns 201', () => pm.response.to.have.status(201));"],
    }),
    request("Suspend target user (routine)", "PATCH", "/admin/users/{{targetUserId}}/status", {
      body: { status: "SUSPENDED", suspension_category: "ROUTINE", reason: "Postman D2 routine suspension lifecycle check" },
      tests: ["pm.test('routine suspension returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Reinstate routine suspension", "POST", "/admin/users/{{targetUserId}}/reinstate", {
      body: { reason: "Routine suspension reviewed and cleared in the Postman QA run." },
      tests: ["pm.test('routine reinstatement succeeds', () => { pm.response.to.have.status(201); pm.expect(pm.response.json().data.status).to.eql('ACTIVE'); });"],
    }),
    request("Request restricted reinstatement (ADMIN; two-person workflow)", "POST", "/admin/users/{{targetUserId}}/reinstate", {
      disabled: true,
      auth: { type: "bearer", bearer: [{ key: "token", value: "{{reinstatementRequesterToken}}", type: "string" }] },
      description: "Optional two-person D2 workflow. Use an ADMIN token with admin.users.reinstate after the target has a SECURITY, FRAUD, LEGAL, or INVESTIGATION suspension. A 201 pending response saves request_audit_id for the SUPER_ADMIN decision requests. The local mock fixture has no ordinary ADMIN profile.",
      body: { reason: "Review completed. Requesting SUPER_ADMIN clearance of the documented restriction." },
      tests: [
        "pm.test('restricted reinstatement is pending approval', () => { pm.response.to.have.status(201); pm.expect(pm.response.json().data.reinstatement_status).to.eql('PENDING_APPROVAL'); });",
        "if (pm.response.code === 201 && pm.response.json().data.request_audit_id) pm.environment.set('reinstatementRequestAuditId', pm.response.json().data.request_audit_id);",
      ],
    }),
    request("Approve restricted reinstatement request (SUPER_ADMIN)", "POST", "/admin/users/{{targetUserId}}/reinstate/approve", {
      disabled: true,
      description: "Run after an ADMIN with explicitly granted admin.users.reinstate submits a restricted reinstatement request. The request audit ID must be captured from its response; this approval clears the restriction and records the approver.",
      bodyRaw: '{\n  "request_audit_id": "{{reinstatementRequestAuditId}}",\n  "approval_reason": "Investigation closed, restriction formally cleared, and reinstatement approved by the SUPER_ADMIN."\n}',
      tests: ["pm.test('restricted reinstatement approval activates account', () => { pm.response.to.have.status(201); pm.expect(pm.response.json().data.status).to.eql('ACTIVE'); });"],
    }),
    request("Reject restricted reinstatement request (SUPER_ADMIN)", "POST", "/admin/users/{{targetUserId}}/reinstate/reject", {
      disabled: true,
      description: "Alternative decision to approval. Run against a pending request audit ID that has not already been decided.",
      body: { request_audit_id: "{{reinstatementRequestAuditId}}", rejection_reason: "The restriction remains active; the submitted evidence does not satisfy the documented clearance criteria." },
      tests: ["pm.test('restricted reinstatement rejection preserves suspension', () => { pm.response.to.have.status(201); pm.expect(pm.response.json().data.status).to.eql('SUSPENDED'); });"],
    }),
    request("Get assigned user roles", "GET", "/admin/users/{{targetUserId}}/roles", {
      tests: [
        "pm.test('admin user roles returns 200', () => pm.response.to.have.status(200));",
        "const assigned = pm.response.json().data;",
        "const assignedIds = assigned.map(item => item.role_id ?? item.id);",
        "pm.environment.set('targetInitialRoleIds', JSON.stringify(assignedIds));",
        "const candidates = JSON.parse(pm.environment.get('assignableRoleCandidates') || '[]');",
        "const roleId = candidates.find(id => !assignedIds.includes(id));",
        "pm.test('a safe temporary role is available', () => pm.expect(roleId).to.be.a('string'));",
        "if (roleId) pm.environment.set('assignmentRoleId', roleId);",
      ],
    }),
    request("Assign temporary eligible role to target user", "POST", "/admin/users/{{targetUserId}}/roles", {
      description:
        "Uses an ordinary assignable role. SUPER_ADMIN assignment is deliberately rejected here and requires the guarded bootstrap process.",
      body: { role_id: "{{assignmentRoleId}}", reason: "Postman admin contract check" },
      tests: ["pm.test('admin role assignment returns 201', () => pm.response.to.have.status(201));"],
    }),
    request("Revoke temporary role from target user", "DELETE", "/admin/users/{{targetUserId}}/roles/{{assignmentRoleId}}", {
      tests: ["pm.test('admin role revocation returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("List admin roles", "GET", "/admin/roles?page=1&page_size=100", {
      tests: [
        "pm.test('admin role list returns 200', () => pm.response.to.have.status(200));",
        "const roles = pm.response.json().data;",
        "const role = roles.find(item => item.code === 'ADMIN');",
        "if (role?.id) pm.environment.set('roleId', role.id);",
        "const demoRole = roles.find(item => item.code === 'DEMO_CUSTOM_ROLE');",
        "if (demoRole?.id) pm.environment.set('demoRoleId', demoRole.id);",
        "pm.environment.set('assignableRoleCandidates', JSON.stringify(roles.filter(item => item.active && item.assignable && item.code !== 'SUPER_ADMIN' && item.code !== 'AUTHENTICATED_USER').map(item => item.id)));",
      ],
    }),
    request("Get role detail and assignment history", "GET", "/admin/roles/{{roleId}}", {
      tests: [
        "pm.test('admin role detail returns 200', () => pm.response.to.have.status(200));",
        "pm.test('role detail includes assignment history', () => pm.expect(pm.response.json().data.assignment_history).to.be.an('array'));",
      ],
    }),
    request("List admin permission catalogue", "GET", "/admin/permissions?page=1&page_size=100", {
      tests: [
        "pm.test('admin permission list returns 200', () => pm.response.to.have.status(200));",
        "pm.test('permissions expose resource/action fields', () => pm.expect(pm.response.json().data[0].resource).to.be.a('string'));",
      ],
    }),
    request("Get admin role permissions", "GET", "/admin/roles/{{demoRoleId}}/permissions", {
      description:
        "Requires the local demo custom role (provided by the frozen mock seed). In a shared environment, replace demoRoleId with an authorized custom role ID.",
      tests: ["pm.test('admin role permission mapping read returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Update admin role permissions", "PUT", "/admin/roles/{{demoRoleId}}/permissions", {
      description: "Only permissions held by the acting administrator can be delegated. System roles are protected.",
      bodyRaw: '{\n  "permission_ids": {{rolePermissionIds}}\n}',
      tests: ["pm.test('admin role permission mapping update returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Search admin audit logs", "GET", "/admin/audit-logs", {
      query: "actor_user_id={{userId}}&target_user_id={{targetUserId}}&page=1&page_size=20",
      description:
        "Audit search also supports action, resource_type, resource_id, result, from, and to. Organization filtering is not applicable because this schema has no organization scope.",
      tests: ["pm.test('admin audit search returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Get admin audit event", "GET", "/admin/audit-logs/{{auditId}}", {
      tests: ["pm.test('admin audit detail returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("List admin settings", "GET", "/admin/settings?page=1&page_size=100", {
      tests: ["pm.test('admin settings list returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Get admin setting detail", "GET", "/admin/settings/default_locale", {
      tests: [
        "pm.test('admin setting detail returns 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('configurationVersion', pm.response.json().data.version);",
        "pm.environment.set('configurationInitialStatus', pm.response.json().data.status);",
      ],
    }),
    request("Patch admin setting with reason and current version", "PATCH", "/admin/settings/default_locale", {
      bodyRaw: '{\n  "value": "en-IN",\n  "expected_version": {{configurationVersion}},\n  "reason": "Postman admin contract check"\n}',
      tests: [
        "pm.test('admin setting update returns 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('configurationVersion', pm.response.json().data.version);",
      ],
    }),
    request("Deactivate setting definition", "PATCH", "/admin/settings/default_locale/status", {
      bodyRaw: '{\n  "status": "INACTIVE",\n  "expected_version": {{configurationVersion}},\n  "reason": "Postman D4 status lifecycle check"\n}',
      tests: ["pm.test('setting deactivation returns 200', () => pm.response.to.have.status(200));", "pm.environment.set('configurationVersion', pm.response.json().data.version);"],
    }),
    request("Restore setting definition status", "PATCH", "/admin/settings/default_locale/status", {
      bodyRaw: '{\n  "status": "{{configurationInitialStatus}}",\n  "expected_version": {{configurationVersion}},\n  "reason": "Restore after Postman D4 status check"\n}',
      tests: ["pm.test('setting status is restored', () => pm.response.to.have.status(200));", "pm.environment.set('configurationVersion', pm.response.json().data.version);"],
    }),
    request("List admin feature flags", "GET", "/admin/feature-flags?page=1&page_size=100", {
      tests: ["pm.test('admin feature flag list returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Read one feature flag", "GET", "/feature-flags/media_upload_enabled", {
      tests: [
        "pm.test('feature flag read returns 200', () => pm.response.to.have.status(200));",
        "pm.test('feature flag includes its version', () => pm.expect(pm.response.json().data.version).to.be.a('number'));",
      ],
    }),
    request("Read admin feature flag detail", "GET", "/admin/feature-flags/media_upload_enabled", {
      tests: [
        "pm.test('admin feature flag detail returns 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('featureFlagVersion', pm.response.json().data.version);",
        "pm.environment.set('featureFlagInitialStatus', pm.response.json().data.status);",
      ],
    }),
    request("Disable feature flag through admin API", "PATCH", "/admin/feature-flags/media_upload_enabled", {
      bodyRaw: '{\n  "enabled": false,\n  "expected_version": {{featureFlagVersion}},\n  "reason": "Postman admin contract check"\n}',
      tests: [
        "pm.test('admin feature flag PATCH returns 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('featureFlagVersion', pm.response.json().data.version);",
      ],
    }),
    request("Restore feature flag through admin API", "PATCH", "/admin/feature-flags/media_upload_enabled", {
      bodyRaw: '{\n  "enabled": true,\n  "expected_version": {{featureFlagVersion}},\n  "reason": "Restore after Admin QA check"\n}',
      tests: [
        "pm.test('admin feature flag restore returns 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('featureFlagVersion', pm.response.json().data.version);",
      ],
    }),
    request("Deactivate feature flag definition", "PATCH", "/admin/feature-flags/media_upload_enabled/status", {
      bodyRaw: '{\n  "status": "INACTIVE",\n  "expected_version": {{featureFlagVersion}},\n  "reason": "Postman D5 status lifecycle check"\n}',
      tests: ["pm.test('feature flag deactivation returns 200', () => pm.response.to.have.status(200));", "pm.environment.set('featureFlagVersion', pm.response.json().data.version);"],
    }),
    request("Restore feature flag definition status", "PATCH", "/admin/feature-flags/media_upload_enabled/status", {
      bodyRaw: '{\n  "status": "{{featureFlagInitialStatus}}",\n  "expected_version": {{featureFlagVersion}},\n  "reason": "Restore after Postman D5 status check"\n}',
      tests: ["pm.test('feature flag status is restored', () => pm.response.to.have.status(200));", "pm.environment.set('featureFlagVersion', pm.response.json().data.version);"],
    }),
    request("Search audit history for target user", "GET", "/admin/audit-logs", {
      query: "target_user_id={{targetUserId}}&page=1&page_size=20",
      tests: ["pm.test('target audit search returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Search audit history performed by target user", "GET", "/admin/audit-logs", {
      query: "actor_user_id={{targetUserId}}&page=1&page_size=20",
      description: "Call separately from the target_user_id query and merge/deduplicate by audit ID for the User Activity screen.",
      tests: ["pm.test('actor audit search returns 200', () => pm.response.to.have.status(200));"],
    }),
    request("Confirm regular-user authorization is denied", "GET", "/users?page=1&page_size=20", {
      description:
        "Run after switching the collection token to mockUserApiAccessToken. Expected 403 verifies backend permission enforcement.",
      auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
      tests: ["pm.test('regular user is denied admin user search', () => pm.response.to.have.status(403));"],
    }),
  ],
};

const adminRequests = adminFolder.item;
const adminFlagDetailRequest = adminRequests.find((item) => item.name === "Read admin feature flag detail");
adminFlagDetailRequest.event[0].script.exec.push(
  "pm.environment.set('featureFlagInitialValue', JSON.stringify(pm.response.json().data.enabled));",
);
const restoreAdminFlagRequest = adminRequests.find((item) => item.name === "Restore feature flag through admin API");
restoreAdminFlagRequest.request.body.raw = [
  "{",
  '  "enabled": {{featureFlagInitialValue}},',
  '  "expected_version": {{featureFlagVersion}},',
  '  "reason": "Restore after Admin feature flag QA check"',
  "}",
].join("\n");
function takeAdminRequests(names) {
  return names.map((name) => {
    const index = adminRequests.findIndex((item) => item.name === name);
    if (index < 0) throw new Error(`Missing admin Postman request: ${name}`);
    return adminRequests.splice(index, 1)[0];
  });
}
function screen(name, description, requests) {
  return { name, description, item: takeAdminRequests(requests) };
}

adminFolder.name = "Admin Screen API Flows (ADM-001 to ADM-018)";
adminFolder.description =
  "Screen-by-screen API flow from the client inventory. The Admin login and My Sessions screens are frontend/shared-identity flows and are documented in their folders; this collection does not create a separate authentication or session API.";
adminFolder.item = [
  {
    name: "ADM-001 Admin Login — shared Auth0 Universal Login",
    description:
      "Frontend route /admin/login. Use the separate admin Auth0 application in the shared tenant and require MFA. No separate admin login, signup, password, or OTP API is created. In the QA runbook, use the local mock admin token setup first.",
    item: [],
  },
  screen("ADM-002 Admin Dashboard", "GET shared-data dashboard summary.", ["GET admin dashboard summary"]),
  screen("ADM-003 User Management", "Search users and change account status.", [
    "List and filter users",
    "Filter users by ID",
    "Filter users by name and email",
    "Set user status (DISABLED)",
    "Restore user status (ACTIVE)",
    "Lock target user",
    "Unlock target user",
    "Suspend target user (routine)",
    "Reinstate routine suspension",
    "Request restricted reinstatement (ADMIN; two-person workflow)",
    "Approve restricted reinstatement request (SUPER_ADMIN)",
    "Reject restricted reinstatement request (SUPER_ADMIN)",
  ]),
  screen("ADM-004 User Details", "Read the selected user's profile and effective roles.", ["Get user details"]),
  screen("ADM-005 User Activity", "Read audit events where the user is the actor or target; merge and deduplicate by audit ID.", [
    "Search audit history for target user",
    "Search audit history performed by target user",
  ]),
  screen(
    "ADM-006 User Role Assignment",
    "Read assignments separately from write permission. DELETE revokes an assignment; it never hard-deletes the user or role. Current ADMIN baseline lacks user.roles.manage, so only SUPER_ADMIN may assign/revoke until the client approves another grant list.",
    ["Get assigned user roles", "Assign temporary eligible role to target user", "Revoke temporary role from target user"],
  ),
  screen("ADM-007 Role Management", "role.read permits listing and viewing roles. No role-definition DELETE endpoint exists.", [
    "List admin roles",
  ]),
  screen("ADM-008 Role Details", "View role fields, permissions, and assignment history.", ["Get role detail and assignment history"]),
  screen("ADM-009 Permission Management", "Read the shared permission catalogue.", ["List admin permission catalogue"]),
  screen("ADM-010 Role-Permission Mapping", "Read and update mappings on an authorized custom role.", [
    "Get admin role permissions",
    "Update admin role permissions",
  ]),
  screen("ADM-011 Audit Log Viewer", "Search immutable audit events with actor and target filters.", ["Search admin audit logs"]),
  screen("ADM-012 Audit Log Details", "Read one immutable audit record.", ["Get admin audit event"]),
  screen("ADM-013 Platform Configuration", "List approved non-secret settings.", ["List admin settings"]),
  screen("ADM-014 Configuration Details and Edit", "Read and update a setting with a reason and version check.", [
    "Get admin setting detail",
    "Patch admin setting with reason and current version",
    "Deactivate setting definition",
    "Restore setting definition status",
  ]),
  screen("ADM-015 Feature Flag Management", "List registered simple feature flags.", ["List admin feature flags"]),
  screen("ADM-016 Feature Flag Details and Edit", "Read, update, and restore a flag using optimistic locking.", [
    "Read one feature flag",
    "Read admin feature flag detail",
    "Disable feature flag through admin API",
    "Restore feature flag through admin API",
    "Deactivate feature flag definition",
    "Restore feature flag definition status",
  ]),
  {
    name: "ADM-017 My Admin Profile",
    description: "Uses the shared authenticated identity/profile endpoint; no duplicate admin profile route.",
    item: [
      request("Get current administrator profile and permissions", "GET", "/auth/me", {
        tests: ["pm.test('authenticated admin profile returns 200', () => pm.response.to.have.status(200));"],
      }),
    ],
  },
  {
    name: "ADM-018 My Sessions — shared Module 1 dependency",
    description:
    "D1 confirms own-session list, details, single revoke, and revoke-others are in scope for the shared Module 1 session capability. The four routes are registered, but currently return 503 session_api_not_implemented because no provider/store, ownership lookup, device metadata source, or revocation behavior is implemented. These requests demonstrate the explicit gap only; see docs/module-1-admin-session-api-gap-analysis.md.",
    item: [
      request("List my sessions — shared API not implemented", "GET", "/me/sessions", {
        description: "D1 gap: endpoint returns 503 until Module 1 or the formally approved Auth0 integration provides shared application-session APIs.",
        tests: ["pm.test('session list reports documented integration gap', () => { pm.response.to.have.status(503); pm.expect(pm.response.json().error?.code ?? pm.response.json().code).to.eql('session_api_not_implemented'); });"],
      }),
      request("Get my session — shared API not implemented", "GET", "/me/sessions/00000000-0000-4000-8000-000000000099", {
        description: "D1 gap: session detail is part of the approved API contract, but the provider and revocation semantics are not implemented.",
        tests: ["pm.test('session detail reports documented integration gap', () => { pm.response.to.have.status(503); pm.expect(pm.response.json().error?.code ?? pm.response.json().code).to.eql('session_api_not_implemented'); });"],
      }),
      request("Revoke my session — shared API not implemented", "DELETE", "/me/sessions/00000000-0000-4000-8000-000000000099", {
        tests: ["pm.test('session revoke reports documented integration gap', () => { pm.response.to.have.status(503); pm.expect(pm.response.json().error?.code ?? pm.response.json().code).to.eql('session_api_not_implemented'); });"],
      }),
      request("Revoke other sessions — shared API not implemented", "POST", "/me/sessions/revoke-others", {
        body: { confirmation: true },
        tests: ["pm.test('revoke others reports documented integration gap', () => { pm.response.to.have.status(503); pm.expect(pm.response.json().error?.code ?? pm.response.json().code).to.eql('session_api_not_implemented'); });"],
      }),
    ],
  },
  {
    name: "Authorization and contract negative checks",
    description:
      "Run with the local regular-user identity; administrative reads and writes, including role-assignment revocation, must be denied unless that principal has the required permission.",
    item: takeAdminRequests(["Confirm regular-user authorization is denied"]),
  },
];
if (adminRequests.length) throw new Error(`Unassigned admin Postman requests: ${adminRequests.map((item) => item.name).join(", ")}`);

function addBodyField(item, key, value) {
  const body = item.request.body ??= { mode: "raw", raw: "{}", options: { raw: { language: "json" } } };
  if (body.mode !== "raw") return;
  const raw = body.raw ?? "{}";
  if (new RegExp(`\\"${key}\\"\\s*:`).test(raw)) return;
  const close = raw.lastIndexOf("}");
  if (close < 0) throw new Error(`Cannot add ${key} to Postman request ${item.name}`);
  const before = raw.slice(0, close).trimEnd();
  const separator = before.trimEnd().endsWith("{") ? "" : ",";
  body.raw = `${before}${separator}\n  ${JSON.stringify(key)}: ${value}\n}`;
}

function ensureTestScript(item, lines) {
  const event = item.event ??= [];
  let test = event.find((entry) => entry.listen === "test");
  if (!test) {
    test = { listen: "test", script: { type: "text/javascript", exec: [] } };
    event.push(test);
  }
  test.script.exec.push(...lines);
}

function completeSharedContracts(items) {
  for (const item of items ?? []) {
    if (item.request) {
      const { method, url } = item.request;
      let rawUrl = typeof url === "string" ? url : url?.raw ?? "";
      if (method === "GET" && /\/users\/\{\{userId\}\}\/roles$/.test(rawUrl)) {
        item.request.url = rawUrl = rawUrl.replace("{{userId}}", "{{targetUserId}}");
      }
      const rawBody = item.request.body?.raw ?? "";
      if (item.request.description) {
        item.request.description = item.request.description
          .replaceAll("user.disable", "admin.users.status.update")
          .replaceAll("user.enable", "admin.users.status.update")
          .replaceAll("user.roles.read", "admin.roles.view")
          .replaceAll("user.roles.manage", "admin.roles.assign or admin.roles.revoke")
          .replaceAll("role.manage", "admin.roles.permissions.manage");
      }
      if (method === "GET" && /\/users\/[^/?]+\/roles(?:\?|$)/.test(rawUrl)) {
        item.request.description = "Requires admin.roles.view. Reads the target user's current and historical role assignments.";
      }
      if (method === "POST" && /\/users\/[^/?]+\/roles(?:\?|$)/.test(rawUrl)) {
        item.request.description = "Requires admin.roles.assign. Assigns an existing assignable role, requires a reason, and records the change in the shared audit log.";
      }
      if (method === "DELETE" && /\/users\/[^/?]+\/roles\/[^/?]+$/.test(rawUrl)) {
        item.request.description = "Requires admin.roles.revoke. Requires a reason and revokes only the assignment; the user and role remain.";
      }
      if (method === "POST" && /\/users\/[^/?]+\/(disable|enable)$/.test(rawUrl)) {
        item.request.description = "Requires admin.users.status.update. Provide the matching status and a reason; status transitions are audited.";
      }
      if (method === "GET" && /\/roles(?:\?|$)/.test(rawUrl)) {
        ensureTestScript(item, [
          "if (pm.response.code === 200) {",
          "  const roles = pm.response.json()?.data || [];",
          "  pm.environment.set('assignableRoleCandidates', JSON.stringify(roles.filter(item => item.active && item.assignable && item.code !== 'SUPER_ADMIN' && item.code !== 'AUTHENTICATED_USER').map(item => item.id)));",
          "}",
        ]);
      }
      if (method === "GET" && /\/users\/\{\{targetUserId\}\}\/roles$/.test(rawUrl)) {
        ensureTestScript(item, [
          "if (pm.response.code === 200) {",
          "  const assigned = pm.response.json()?.data || [];",
          "  const assignedIds = assigned.map(item => item.role_id ?? item.id);",
          "  pm.environment.set('targetInitialRoleIds', JSON.stringify(assignedIds));",
          "  const candidates = JSON.parse(pm.environment.get('assignableRoleCandidates') || '[]');",
          "  const roleId = candidates.find(id => !assignedIds.includes(id));",
          "  pm.test('a safe temporary role is available', () => pm.expect(roleId).to.be.a('string'));",
          "  if (roleId) pm.environment.set('assignmentRoleId', roleId);",
          "}",
        ]);
      }
      if (method === "POST" && /\/users\/\{\{targetUserId\}\}\/roles$/.test(rawUrl) && item.request.body?.raw)
        item.request.body.raw = item.request.body.raw.replace(/("role_id"\s*:\s*)"\{\{roleId\}\}"/, '$1"{{assignmentRoleId}}"');
      if (method === "DELETE" && /\/users\/\{\{targetUserId\}\}\/roles\/\{\{roleId\}\}$/.test(rawUrl))
        item.request.url = item.request.url.replace("{{roleId}}", "{{assignmentRoleId}}");
      if (method === "PATCH" && /\/admin\/users\/.*\/status/.test(rawUrl)) {
        addBodyField(item, "reason", JSON.stringify("Postman account status contract check"));
        if (/\"status\"\s*:\s*\"SUSPENDED\"/.test(rawBody)) addBodyField(item, "suspension_category", JSON.stringify("ROUTINE"));
      }
      if (method === "POST" && /\/users\/.*\/disable$/.test(rawUrl)) {
        addBodyField(item, "status", JSON.stringify("DISABLED"));
        addBodyField(item, "reason", JSON.stringify("Postman Module 1 disable contract check"));
      }
      if (method === "POST" && /\/users\/.*\/enable$/.test(rawUrl)) {
        addBodyField(item, "status", JSON.stringify("ACTIVE"));
        addBodyField(item, "reason", JSON.stringify("Postman Module 1 enable contract check"));
      }
      if (method === "DELETE" && /\/users\/.*\/roles\/[^/]+$/.test(rawUrl))
        addBodyField(item, "reason", JSON.stringify("Postman role revocation contract check"));
      if (method === "PUT" && /\/roles\/[^/]+\/permissions$/.test(rawUrl))
        addBodyField(item, "reason", JSON.stringify("Postman role permission mapping contract check"));
      if (method === "PUT" && /\/configurations\/[^/?]+$/.test(rawUrl))
        addBodyField(item, "reason", JSON.stringify("Postman configuration contract check"));
      if (method === "PUT" && /\/feature-flags\/[^/?]+$/.test(rawUrl)) {
        const versionName = rawUrl.includes("/admin/") ? "featureFlagVersion" : "coreFeatureFlagVersion";
        addBodyField(item, "expected_version", `{{${versionName}}}`);
        addBodyField(item, "reason", JSON.stringify("Postman feature flag contract check"));
        ensureTestScript(item, [`pm.environment.set('${versionName}', pm.response.json().data.version);`]);
      }
      if (method === "GET" && /\/feature-flags\/[^/?]+$/.test(rawUrl)) {
        const versionName = rawUrl.includes("/admin/") ? "featureFlagVersion" : "coreFeatureFlagVersion";
        ensureTestScript(item, [`if (pm.response.code === 200) pm.environment.set('${versionName}', pm.response.json().data.version);`]);
      }
    }
    completeSharedContracts(item.item);
  }
}

for (const path of collectionPaths) {
  const collection = JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, ""));
  collection.item = collection.item.filter((folder) => ![adminFolder.name, "Admin console APIs (client contract)"].includes(folder.name));
  const folder = structuredClone(adminFolder);
  if (path.includes("Frozen-API")) {
    folder.auth = { type: "bearer", bearer: [{ key: "token", value: "{{mockAdminApiAccessToken}}", type: "string" }] };
  } else {
    folder.auth = { type: "bearer", bearer: [{ key: "token", value: "{{adminApiAccessToken}}", type: "string" }] };
    const denialRequest = folder.item
      .find((item) => item.name === "Authorization and contract negative checks")
      ?.item.find((item) => item.name === "Confirm regular-user authorization is denied");
    if (denialRequest) denialRequest.request.auth.bearer[0].value = "{{auth0ApiAccessToken}}";
  }
  collection.item.push(folder);
  completeSharedContracts(collection.item);
  await writeFile(path, `${JSON.stringify(collection, null, 2)}\n`);
}

const environmentPath = "postman/Examinity-Module-1.postman_environment.json";
const environment = JSON.parse((await readFile(environmentPath, "utf8")).replace(/^\uFEFF/, ""));
const addVariable = (key, value, description) => {
  if (!environment.values.some((entry) => entry.key === key)) {
    environment.values.push({ key, value, type: "default", enabled: true, description });
  }
};
addVariable(
  "adminApiAccessToken",
  "",
  "Access token issued by the dedicated Auth0 admin application after MFA. Keep it local; do not commit or export a populated value.",
);
addVariable("userSearch", "", "Optional name or email search value for the admin user list.");
addVariable("targetUserName", "", "First name captured from regular mock identity sync for user-name filter checks.");
addVariable("targetUserEmail", "", "Email captured from regular mock identity sync for user-email filter checks.");
addVariable("mobileSearch", "", "Optional mobile number filter for the admin user list.");
addVariable("createdFrom", "2026-01-01T00:00:00.000Z", "Registration start date filter for the admin user list.");
addVariable("createdTo", "2026-12-31T23:59:59.999Z", "Registration end date filter for the admin user list.");
addVariable("featureFlagVersion", "1", "Current feature flag version; updated automatically by the admin detail and PATCH requests.");
addVariable("coreFeatureFlagVersion", "1", "Current Module 1 feature flag version; updated automatically by detail and PUT requests.");
addVariable("configurationInitialValue", '"en"', "Original configuration value captured by the Admin QA runbook before its write check.");
addVariable("rolePermissionInitialIds", "[]", "Original DEMO_CUSTOM_ROLE permission IDs captured before the Admin QA mapping write check.");
addVariable("coreConfigurationInitialValue", '"en"', "Original value captured before testing the Module 1 configuration route.");
addVariable("coreFeatureFlagInitialValue", "false", "Original value captured before testing the Module 1 feature flag route.");
addVariable("reinstatementRequestAuditId", "", "Audit ID returned by a restricted reinstatement request submitted by an authorized ADMIN; used by SUPER_ADMIN approve/reject requests.");
addVariable("assignableRoleCandidates", "[]", "Eligible role IDs captured from the role list, excluding SUPER_ADMIN and AUTHENTICATED_USER.");
addVariable("targetInitialRoleIds", "[]", "Original target-user role assignment IDs captured before the temporary role assignment check.");
addVariable("assignmentRoleId", "", "Temporary role ID selected from eligible roles not already assigned to the target user.");
addVariable("reinstatementRequesterToken", "", "Optional ADMIN bearer token with admin.users.reinstate, used for D2 two-person reinstatement requests. Keep local and uncommitted.");
addVariable("coreRolePermissionInitialIds", "[]", "Original permission IDs captured before testing the Module 1 role mapping route.");
addVariable("profileInitialBody", "{}", "Current profile fields captured before the self-profile update check.");
addVariable("preferencesInitialBody", "{}", "Current email preferences captured before the self-preferences update check.");
addVariable(
  "featureFlagInitialValue",
  "false",
  "Original feature flag state captured before PATCH and restored at the end of the Postman flow.",
);
environment.values.find((entry) => entry.key === "adminApiAccessToken").type = "secret";
await writeFile(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);

console.log(`Updated ${collectionPaths.length} Postman collections and the shared environment.`);
