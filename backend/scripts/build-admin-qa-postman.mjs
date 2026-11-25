import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "postman/Examinity-Module-1-Frozen-API.postman_collection.json";
const outputPath = "postman/Examinity-Admin-QA.postman_collection.json";
const source = JSON.parse((await readFile(sourcePath, "utf8")).replace(/^\uFEFF/, ""));
const clone = (value) => structuredClone(value);
const folder = (name) => {
  const exact = source.item.find((item) => item.name === name);
  if (exact) return exact;
  const label = name.replace(/^\d+\s*-\s*/, "").toLowerCase();
  return source.item.find((item) => item.name.replace(/^\d+\s*-\s*/, "").toLowerCase() === label);
};
const findRequest = (items, name) => {
  for (const item of items ?? []) {
    if (item.name === name && item.request) return item;
    const nested = findRequest(item.item, name);
    if (nested) return nested;
  }
  return undefined;
};

const screens = clone(folder("Admin Screen API Flows (ADM-001 to ADM-018)"));
if (!screens) throw new Error("Admin screen flows are missing; run scripts/update-admin-postman.mjs first.");
const byPrefix = (prefix) => screens.item.find((item) => item.name.startsWith(prefix));

const assignmentFolder = byPrefix("ADM-006");
const assignIndex = assignmentFolder.item.findIndex((item) => item.name === "Assign temporary eligible role to target user");
const duplicateAssignment = clone(assignmentFolder.item[assignIndex]);
duplicateAssignment.name = "Repeat temporary role assignment (idempotency check)";
duplicateAssignment.request.description = "Repeating an active assignment must not create a second assignment or corrupt history.";
duplicateAssignment.event[0].script.exec = [
  "pm.test('duplicate role assignment is idempotent', () => {",
  "  pm.response.to.have.status(201);",
  "  pm.expect(pm.response.json().data.unchanged).to.equal(true);",
  "});",
];
assignmentFolder.item.splice(assignIndex + 1, 0, duplicateAssignment);

// IDs and current values are captured from earlier requests, so the collection is runnable top to bottom.
const permissionList = findRequest(screens.item, "List admin permission catalogue");
permissionList.event[0].script.exec.push(
  "const permissions = pm.response.json().data;",
  "pm.environment.set('rolePermissionIds', JSON.stringify(permissions.slice(0, 2).map(item => item.id)));",
);
const auditSearch = findRequest(screens.item, "Search admin audit logs");
auditSearch.event[0].script.exec.push(
  "const events = pm.response.json().data;",
  "if (events[0]?.id) pm.environment.set('auditId', events[0].id);",
  "const actions = events.map(event => event.action);",
  "pm.test('status and role mutations are audited for the selected user', () => {",
  "  pm.expect(actions).to.include('ACCOUNT_DISABLED');",
  "  pm.expect(actions).to.include('ACCOUNT_ENABLED');",
  "  pm.expect(actions).to.include('ROLE_ASSIGNED');",
  "  pm.expect(actions).to.include('ROLE_REMOVED');",
  "});",
);
const mappingRead = findRequest(screens.item, "Get admin role permissions");
mappingRead.event[0].script.exec.push(
  "const ids = pm.response.json().data.map(item => item.id);",
  "pm.environment.set('rolePermissionInitialIds', JSON.stringify(ids));",
);
const mappingFolder = byPrefix("ADM-010");
const mappingUpdateIndex = mappingFolder.item.findIndex((item) => item.name === "Update admin role permissions");
const mappingRestore = clone(mappingFolder.item[mappingUpdateIndex]);
mappingRestore.name = "Restore original admin role permissions";
mappingRestore.request.description = "Restore the mapping captured by the preceding read request after this QA write check.";
mappingRestore.request.body.raw = '{\n  "permission_ids": {{rolePermissionInitialIds}},\n  "reason": "Restore after Admin QA role mapping check"\n}';
mappingRestore.event[0].script.exec = ["pm.test('original role permission mapping is restored', () => pm.response.to.have.status(200));"];
mappingFolder.item.splice(mappingUpdateIndex + 1, 0, mappingRestore);

const settingGet = findRequest(screens.item, "Get admin setting detail");
settingGet.event[0].script.exec.push("pm.environment.set('configurationInitialValue', JSON.stringify(pm.response.json().data.value));");
const settingFolder = byPrefix("ADM-014");
const settingUpdateIndex = settingFolder.item.findIndex((item) => item.name === "Patch admin setting with reason and current version");
const settingRestore = clone(settingFolder.item[settingUpdateIndex]);
settingRestore.name = "Restore original admin setting value";
settingRestore.request.body.raw =
  '{\n  "value": {{configurationInitialValue}},\n  "expected_version": {{configurationVersion}},\n  "reason": "Restore after Admin QA check"\n}';
settingRestore.event[0].script.exec = [
  "pm.test('original setting value is restored', () => pm.response.to.have.status(200));",
  "pm.environment.set('configurationVersion', pm.response.json().data.version);",
];
settingFolder.item.splice(settingUpdateIndex + 1, 0, settingRestore);

const identity = source.item.find((item) => item.name.endsWith(" - Authentication and identity"));
const syncAdmin = identity.item.find((item) => item.name === "POST /api/v1/auth/sync");
const syncUser = identity.item.find((item) => item.name === "POST /api/v1/auth/sync (regular demo user)");
syncUser.event[0].script.exec.push(
  "if (pm.response.code === 200) {",
  "  const syncResponse = pm.response.json();",
  "  if (syncResponse?.data?.user?.first_name) pm.environment.set('targetUserName', syncResponse.data.user.first_name);",
  "  if (syncResponse?.data?.user?.email) pm.environment.set('targetUserEmail', syncResponse.data.user.email);",
  "}",
);
const setupIdentity = {
  name: "03 - Sync mock admin and QA user",
  description: "Run after both local mock token requests. Captures userId and targetUserId for subsequent screen requests.",
  item: [clone(syncAdmin), clone(syncUser)],
};

const sharedIdentity = {
  name: "05 - Shared identity profile and logout",
  description:
    "Module 1 identity endpoints. The regular user can see their own effective roles from /auth/me; this does not grant role-catalogue or assignment-management permissions. Logout records the application audit event; Auth0/BFF owns browser session termination.",
  item: [
    clone(identity.item.find((item) => item.name === "GET /api/v1/auth/me")),
    {
      name: "GET /api/v1/auth/me (regular user sees own roles)",
      request: {
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
        method: "GET",
        url: "{{baseUrl}}/auth/me",
        description: "Returns the caller's own effective role codes. It does not allow browsing or changing other users' role assignments.",
      },
      response: [],
      event: [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: [
              "pm.test('regular user profile returns 200', () => pm.response.to.have.status(200));",
              "pm.test('regular user can see own effective roles', () => pm.expect(pm.response.json().data.roles).to.include('AUTHENTICATED_USER'));",
            ],
          },
        },
      ],
    },
    clone(identity.item.find((item) => item.name === "POST /api/v1/auth/logout")),
  ],
};

const coreUsers = clone(folder("04 - Users and ID administration"));
coreUsers.name = "06 - User profile, preferences, and account actions (Module 1 routes)";
const userDetail = findRequest(coreUsers.item, "GET /api/v1/users/:id");
userDetail.event = [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        "pm.test('user detail returns 200', () => pm.response.to.have.status(200));",
        "const data = pm.response.json().data;",
        "const profile = data.profile || {};",
        "pm.environment.set('profileInitialBody', JSON.stringify({ first_name: data.first_name, last_name: data.last_name, display_name: profile.displayName || '', locale: profile.locale || 'en-IN', timezone: profile.timezone || 'Asia/Kolkata' }));",
      ],
    },
  },
];
const profileUpdateIndex = coreUsers.item.findIndex((item) => item.name === "PATCH /api/v1/users/:id");
const profileRestore = clone(coreUsers.item[profileUpdateIndex]);
profileRestore.name = "Restore original user profile";
profileRestore.request.body.raw = "{{profileInitialBody}}";
profileRestore.event = [
  {
    listen: "test",
    script: { type: "text/javascript", exec: ["pm.test('original profile is restored', () => pm.response.to.have.status(200));"] },
  },
];
coreUsers.item.splice(profileUpdateIndex + 1, 0, profileRestore);
const preferenceRead = findRequest(coreUsers.item, "GET /api/v1/users/:id/preferences");
preferenceRead.event = [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        "pm.test('own preferences return 200', () => pm.response.to.have.status(200));",
        "const data = pm.response.json().data;",
        "pm.environment.set('preferencesInitialBody', JSON.stringify({ transactional_email_enabled: data.transactional_email_enabled, marketing_email_enabled: data.marketing_email_enabled }));",
      ],
    },
  },
];
const preferenceUpdateIndex = coreUsers.item.findIndex((item) => item.name === "PATCH /api/v1/users/:id/preferences");
const preferenceRestore = clone(coreUsers.item[preferenceUpdateIndex]);
preferenceRestore.name = "Restore original notification preferences";
preferenceRestore.request.body.raw = "{{preferencesInitialBody}}";
preferenceRestore.event = [
  {
    listen: "test",
    script: { type: "text/javascript", exec: ["pm.test('original preferences are restored', () => pm.response.to.have.status(200));"] },
  },
];
coreUsers.item.splice(preferenceUpdateIndex + 1, 0, preferenceRestore);

const coreRoles = clone(folder("05 - Role permission write and assignment"));
coreRoles.name = "07 - Roles and permissions (Module 1 routes)";
const coreMappingRead = findRequest(coreRoles.item, "GET /api/v1/roles/:id/permissions");
coreMappingRead.event = [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        "pm.test('role permissions return 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('coreRolePermissionInitialIds', JSON.stringify(pm.response.json().data.map(item => item.id)));",
      ],
    },
  },
];
const coreMappingUpdateIndex = coreRoles.item.findIndex((item) => item.name === "PUT /api/v1/roles/:id/permissions");
const coreMappingRestore = clone(coreRoles.item[coreMappingUpdateIndex]);
coreMappingRestore.name = "Restore original Module 1 role permissions";
coreMappingRestore.request.body.raw = '{\n  "permission_ids": {{coreRolePermissionInitialIds}}\n}';
coreMappingRestore.event = [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: ["pm.test('original Module 1 role permissions are restored', () => pm.response.to.have.status(200));"],
    },
  },
];
coreRoles.item.splice(coreMappingUpdateIndex + 1, 0, coreMappingRestore);

const corePlatform = clone(folder("06 - Configuration and feature flags"));
corePlatform.name = "08 - Configuration and feature flags (Module 1 routes)";
const coreConfigurationGet = findRequest(corePlatform.item, "GET /api/v1/configurations/default_locale");
coreConfigurationGet.event[0].script.exec.push(
  "const configResponse = pm.response.json();",
  "pm.environment.set('coreConfigurationInitialValue', JSON.stringify(configResponse?.data?.value));",
);
const coreConfigurationPutIndex = corePlatform.item.findIndex((item) => item.name === "PUT /api/v1/configurations/default_locale");
corePlatform.item[coreConfigurationPutIndex].event = [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        "pm.test('configuration PUT returns 200', () => pm.response.to.have.status(200));",
        "pm.environment.set('configurationVersion', pm.response.json().data.version);",
      ],
    },
  },
];
const coreConfigurationRestore = clone(corePlatform.item[coreConfigurationPutIndex]);
coreConfigurationRestore.name = "Restore original Module 1 configuration";
coreConfigurationRestore.request.body.raw =
  '{\n  "value": {{coreConfigurationInitialValue}},\n  "expected_version": {{configurationVersion}},\n  "reason": "Restore after Module 1 configuration QA check"\n}';
coreConfigurationRestore.event[0].script.exec = [
  "pm.test('original Module 1 configuration is restored', () => pm.response.to.have.status(200));",
  "pm.environment.set('configurationVersion', pm.response.json().data.version);",
];
corePlatform.item.splice(coreConfigurationPutIndex + 1, 0, coreConfigurationRestore);
const adminFlagGet = clone(findRequest(screens.item, "Read one feature flag"));
adminFlagGet.name = "GET /api/v1/feature-flags/:key (capture original state)";
adminFlagGet.event[0].script.exec.push(
  "pm.environment.set('coreFeatureFlagInitialValue', JSON.stringify(pm.response.json().data.enabled));",
  "pm.environment.set('coreFeatureFlagVersion', pm.response.json().data.version);",
);
const coreFeaturePutIndex = corePlatform.item.findIndex((item) => item.name === "PUT /api/v1/feature-flags/media_upload_enabled");
corePlatform.item.splice(coreFeaturePutIndex, 0, adminFlagGet);
const coreFeatureRestore = clone(corePlatform.item[coreFeaturePutIndex + 1]);
coreFeatureRestore.name = "Restore original Module 1 feature flag";
coreFeatureRestore.request.body.raw = '{\n  "enabled": {{coreFeatureFlagInitialValue}},\n  "expected_version": {{coreFeatureFlagVersion}},\n  "reason": "Restore after Module 1 feature flag QA check"\n}';
coreFeatureRestore.event = [
  {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        "pm.test('original Module 1 feature flag is restored', () => pm.response.to.have.status(200));",
        "pm.environment.set('coreFeatureFlagVersion', pm.response.json().data.version);",
      ],
    },
  },
];
corePlatform.item.splice(coreFeaturePutIndex + 2, 0, coreFeatureRestore);

const coreAudit = clone(folder("07 - Audit log"));
coreAudit.name = "09 - Audit log (Module 1 routes)";
const coreMedia = clone(folder("08 - Media"));
coreMedia.name = "10 - Media lifecycle";
const coreDenied = clone(folder("09 - Regular user authorization checks"));
coreDenied.name = "11 - Regular-user permission checks (expected 403)";
const expected403 = (name, method, path, body) => ({
  name,
  request: {
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
    method,
    header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
    url: `{{baseUrl}}${path}`,
    ...(body ? { body: { mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } } } : {}),
  },
  response: [],
  event: [
    {
      listen: "test",
      script: { type: "text/javascript", exec: [`pm.test('${name} is denied to a regular user', () => pm.response.to.have.status(403));`] },
    },
  ],
});
coreDenied.item.push(
  expected403("DELETE role assignment (Module 1 route, expected 403)", "DELETE", "/users/{{targetUserId}}/roles/{{roleId}}"),
  expected403("DELETE role assignment (Admin alias, expected 403)", "DELETE", "/admin/users/{{targetUserId}}/roles/{{roleId}}"),
  expected403("PATCH account status (Admin route, expected 403)", "PATCH", "/admin/users/{{targetUserId}}/status", { status: "DISABLED" }),
  expected403("POST account lock (expected 403)", "POST", "/admin/users/{{targetUserId}}/lock", { reason: "Negative permission check for account lock" }),
  expected403("POST account reinstatement (expected 403)", "POST", "/admin/users/{{targetUserId}}/reinstate", { reason: "Negative permission check for account reinstatement" }),
  expected403("PUT role permission mapping (expected 403)", "PUT", "/admin/roles/{{demoRoleId}}/permissions", { permission_ids: [] }),
  expected403("PATCH platform setting (expected 403)", "PATCH", "/admin/settings/default_locale", {
    value: "en-IN",
    expected_version: 1,
    reason: "Negative permission check",
  }),
  expected403("PATCH feature flag (expected 403)", "PATCH", "/admin/feature-flags/media_upload_enabled", {
    enabled: false,
    expected_version: 1,
  }),
);
coreDenied.item.unshift(
  {
    name: "GET /api/v1/admin/dashboard without token (expected 401)",
    request: { auth: { type: "noauth" }, method: "GET", url: "{{baseUrl}}/admin/dashboard" },
    response: [],
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: ["pm.test('protected admin API requires authentication', () => pm.response.to.have.status(401));"],
        },
      },
    ],
  },
  {
    name: "GET /api/v1/admin/users/:id with malformed UUID (expected 400)",
    request: { method: "GET", url: "{{baseUrl}}/admin/users/not-a-uuid" },
    response: [],
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: ["pm.test('malformed user ID is rejected', () => pm.response.to.have.status(400));"] },
      },
    ],
  },
  {
    name: "GET /api/v1/admin/users with invalid pagination (expected 400)",
    request: { method: "GET", url: "{{baseUrl}}/admin/users?page=0&page_size=20" },
    response: [],
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: ["pm.test('invalid pagination is rejected', () => pm.response.to.have.status(400));"] },
      },
    ],
  },
  {
    name: "PATCH /api/v1/admin/users/:id/status with invalid status (expected 400)",
    request: {
      method: "PATCH",
      header: [{ key: "Content-Type", value: "application/json" }],
      url: "{{baseUrl}}/admin/users/{{targetUserId}}/status",
      body: { mode: "raw", raw: '{\n  "status": "DELETED"\n}', options: { raw: { language: "json" } } },
    },
    response: [],
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: ["pm.test('unsupported account status is rejected', () => pm.response.to.have.status(400));"],
        },
      },
    ],
  },
);

const disabledAccountChecks = {
  name: "12 - Disabled-account access and recovery",
  description:
    "Local mock QA only. This temporarily disables the synced regular user, confirms /auth/me is denied, then re-enables the account. If execution stops after disable, rerun the final restore request before continuing.",
  item: [
    {
      name: "Temporarily disable synced QA user",
      request: {
        method: "PATCH",
        header: [{ key: "Content-Type", value: "application/json" }],
        url: "{{baseUrl}}/admin/users/{{targetUserId}}/status",
        body: { mode: "raw", raw: '{\n  "status": "DISABLED"\n}', options: { raw: { language: "json" } } },
      },
      response: [],
      event: [
        {
          listen: "test",
          script: { type: "text/javascript", exec: ["pm.test('QA account was disabled', () => pm.response.to.have.status(200));"] },
        },
      ],
    },
    {
      name: "GET /api/v1/auth/me while account is disabled (expected 403)",
      request: {
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
        method: "GET",
        url: "{{baseUrl}}/auth/me",
      },
      response: [],
      event: [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: ["pm.test('disabled user cannot access the application', () => pm.response.to.have.status(403));"],
          },
        },
      ],
    },
    {
      name: "Restore synced QA user to ACTIVE",
      request: {
        method: "PATCH",
        header: [{ key: "Content-Type", value: "application/json" }],
        url: "{{baseUrl}}/admin/users/{{targetUserId}}/status",
        body: { mode: "raw", raw: '{\n  "status": "ACTIVE"\n}', options: { raw: { language: "json" } } },
      },
      response: [],
      event: [
        {
          listen: "test",
          script: { type: "text/javascript", exec: ["pm.test('QA account was restored', () => pm.response.to.have.status(200));"] },
        },
      ],
    },
  ],
};

const sortedScreens = [
  "ADM-001",
  "ADM-002",
  "ADM-007",
  "ADM-009",
  "ADM-003",
  "ADM-004",
  "ADM-005",
  "ADM-006",
  "ADM-008",
  "ADM-010",
  "ADM-011",
  "ADM-012",
  "ADM-013",
  "ADM-014",
  "ADM-015",
  "ADM-016",
  "ADM-017",
  "ADM-018",
  "Authorization and contract negative checks",
]
  .map((prefix) => byPrefix(prefix))
  .filter(Boolean);

const collection = {
  info: {
    _postman_id: "a1c0e7e2-4b11-4f0d-9c3a-examinity-admin-qa",
    name: "Examinity Admin API - QA Runbook",
    description:
      "End-to-end QA for listed Admin screens and shared Module 1 identity, user, RBAC, configuration, feature-flag, audit, and media APIs. Import with Examinity Shared Demo environment. Start `corepack pnpm client:demo`, then run folders top to bottom. Local mock only; tokens are issued by the fixture, not real Auth0. Reversible write checks restore changed values. ADM-001 uses shared Auth0 login; ADM-018 sends four registered session routes and asserts their current 503 gap response. Session operations are in scope but the provider is not implemented.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockAdminApiAccessToken}}", type: "string" }] },
  item: [
    clone(folder("00 - Local mock admin authentication")),
    clone(folder("01 - Local mock user authentication")),
    clone(folder("02 - Health")),
    setupIdentity,
    {
      name: "04 - Admin screen API flows (dependency order)",
      description: "Screen folders are sequenced so list/detail requests capture IDs before dependent edits and details.",
      item: sortedScreens,
    },
    sharedIdentity,
    coreUsers,
    coreRoles,
    corePlatform,
    coreAudit,
    coreMedia,
    coreDenied,
    disabledAccountChecks,
  ],
};

await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
