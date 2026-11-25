import { readFileSync, writeFileSync } from "node:fs";

const collectionPath = "postman/Examinity-Module-1-Frozen-API.postman_collection.json";
const environmentPath = "postman/Examinity-Module-1.postman_environment.json";
const collection = JSON.parse(readFileSync(collectionPath, "utf8"));
const environment = JSON.parse(readFileSync(environmentPath, "utf8"));
const folder = (name) => collection.item.find((item) => item.name === name);
const request = (folderName, requestName) => folder(folderName).item.find((item) => item.name === requestName);
const script = (lines) => [{ listen: "test", script: { type: "text/javascript", exec: lines } }];
const tokenRequest = (name, profile, environmentKey, description) => ({
  name,
  event: script([
    "if (pm.response.code === 200) {",
    "  const body = pm.response.json();",
    `  if (body.access_token) pm.environment.set('${environmentKey}', body.access_token);`,
    `  pm.test('${name} issued', function () { pm.expect(body.access_token).to.be.a('string'); });`,
    "}",
  ]),
  request: {
    auth: { type: "noauth" },
    method: "POST",
    header: [{ key: "Content-Type", value: "application/json" }],
    body: { mode: "raw", raw: JSON.stringify({ profile }, null, 2) },
    url: "{{mockIssuerUrl}}/oauth/token",
    description,
  },
});

collection.info.description =
  "Client demo collection for every frozen Module 1 core endpoint plus the two self-service preference routes. Start corepack pnpm client:demo. Run: mock admin token → mock regular-user token → sync admin → sync regular user → health and admin API folders → expected regular-user 403 checks. Local mock only; no username/password credentials or real Auth0/storage integration.";
collection.info.description =
  "Client demo for frozen Module 1 APIs. Start corepack pnpm client:demo; run admin/user token setup, then local email or phone OTP start and verify, sync the chosen identity, and continue through the API folders. OTP responses show a mock_code; no email or SMS is sent and no real contact is verified. Local mock only; no passwords or real Auth0/storage integration.";
collection.auth = { type: "bearer", bearer: [{ key: "token", value: "{{mockAdminApiAccessToken}}", type: "string" }] };

const adminFolder = folder("00 - Local mock authentication") ?? folder("00 - Local mock admin authentication");
adminFolder.name = "00 - Local mock admin authentication";
adminFolder.description =
  "Issue a short-lived SUPER_ADMIN fixture token. Start corepack pnpm client:demo first; it starts the loopback services and performs the guarded bootstrap. No username or password is used.";
adminFolder.item[0] = tokenRequest(
  "Issue local SUPER_ADMIN token",
  "admin",
  "mockAdminApiAccessToken",
  "Local development only. Fixed mock admin identity. SUPER_ADMIN is assigned by the guarded client:demo bootstrap.",
);
const userFolder = {
  name: "01 - Local mock user authentication",
  description: "Issue a verified standard-user fixture token for permission-denial checks. No username or password is used.",
  item: [
    tokenRequest(
      "Issue local regular user token",
      "user",
      "mockUserApiAccessToken",
      "Local development only. Fixed regular-user identity without administrator permissions.",
    ),
  ],
};
collection.item = collection.item.filter((item) => item.name !== "00 - Local mock admin authentication" && item.name !== userFolder.name);
const passwordlessFolder = (channel, identifier, codeKey, tokenKey) => ({
  name: `02 - Local mock ${channel} OTP login/register`,
  description: `Passwordless ${channel} walkthrough with a fixed local fixture identity. The issuer displays a mock_code in the start response; it sends no email/SMS and does not prove a real address or phone number. After verification, sync to create the local Examinity account.`,
  item: [
    {
      name: `Start ${channel} OTP (mock only)`,
      request: {
        auth: { type: "noauth" }, method: "POST",
        header: [{ key: "Content-Type", value: "application/json" }],
        body: { mode: "raw", raw: JSON.stringify({ connection: channel === "email" ? "email" : "sms", [identifier.key]: identifier.value }, null, 2) },
        url: "{{mockIssuerUrl}}/mock/passwordless/start",
        description: "Local mock only. Response includes mock_code for the next request. No message is delivered.",
      },
      event: script(["if (pm.response.code === 200) {", "  const body = pm.response.json();", `  if (body.mock_code) pm.environment.set('${codeKey}', body.mock_code);`, "  pm.test('Mock challenge created; no real message sent', function () { pm.expect(body.delivery).to.eql('mock_only'); });", "}"]),
    },
    {
      name: `Verify ${channel} OTP and issue token`,
      request: {
        auth: { type: "noauth" }, method: "POST",
        header: [{ key: "Content-Type", value: "application/json" }],
        body: { mode: "raw", raw: JSON.stringify({ connection: channel === "email" ? "email" : "sms", [identifier.key]: identifier.value, code: `{{${codeKey}}}` }, null, 2) },
        url: "{{mockIssuerUrl}}/mock/passwordless/verify",
        description: `Enter the mock_code returned by Start ${channel} OTP. This token is for local demo only.`,
      },
      event: script(["if (pm.response.code === 200) {", "  const body = pm.response.json();", `  if (body.access_token) pm.environment.set('${tokenKey}', body.access_token);`, "  pm.test('Passwordless mock token issued', function () { pm.expect(body.access_token).to.be.a('string'); });", "}"]),
    },
  ],
});
const emailFolder = passwordlessFolder("email", { key: "email", value: "email.demo@example.test" }, "mockEmailOtpCode", "mockEmailApiAccessToken");
const phoneFolder = passwordlessFolder("phone", { key: "phone_number", value: "+15555550123" }, "mockPhoneOtpCode", "mockPhoneApiAccessToken");
emailFolder.name = "02 - Local mock Email OTP login/register";
phoneFolder.name = "03 - Local mock Phone OTP login/register";
collection.item = collection.item.filter((item) => item.name !== emailFolder.name && item.name !== phoneFolder.name);
collection.item.unshift(adminFolder, userFolder, emailFolder, phoneFolder);

const folderRenames = new Map([
  ["01 - Health", "04 - Health"],
  ["02 - Health", "04 - Health"],
  ["02 - Authentication and identity", "05 - Authentication and identity"],
  ["03 - Authentication and identity", "05 - Authentication and identity"],
  ["03 - Users and ID administration", "06 - Users and ID administration"],
  ["04 - Users and ID administration", "06 - Users and ID administration"],
  ["04 - Role permission write and assignment", "07 - Role permission write and assignment"],
  ["05 - Role permission write and assignment", "07 - Role permission write and assignment"],
  ["05 - Configuration and feature flags", "08 - Configuration and feature flags"],
  ["06 - Configuration and feature flags", "08 - Configuration and feature flags"],
  ["06 - Audit log", "09 - Audit log"],
  ["07 - Audit log", "09 - Audit log"],
  ["07 - Media", "10 - Media"],
  ["08 - Media", "10 - Media"],
]);
for (const item of collection.item) if (folderRenames.has(item.name)) item.name = folderRenames.get(item.name);

const auth = folder("05 - Authentication and identity");
const adminSync = auth.item.find((item) => item.name === "POST /api/v1/auth/sync");
adminSync.request.description =
  "Local demo: run with the mock SUPER_ADMIN token. Syncs the admin identity and saves userId. In production, identity comes from a validated Auth0 API access token.";
adminSync.event = script([
  "if (pm.response.code === 200) {",
  "  const body = pm.response.json();",
  "  if (body?.data?.user?.id) pm.environment.set('userId', body.data.user.id);",
  "  if (body?.data?.roles) pm.environment.set('effectiveRoles', JSON.stringify(body.data.roles));",
  "  pm.test('Admin identity sync succeeded', function () { pm.response.to.have.status(200); });",
  "}",
]);
const regularSync = {
  name: "POST /api/v1/auth/sync (regular demo user)",
  event: script([
    "if (pm.response.code === 200) {",
    "  const body = pm.response.json();",
    "  if (body?.data?.user?.id) pm.environment.set('targetUserId', body.data.user.id);",
    "  if (body?.data?.roles) pm.environment.set('regularUserRoles', JSON.stringify(body.data.roles));",
    "  pm.test('Regular user identity sync succeeded', function () { pm.response.to.have.status(200); });",
    "}",
  ]),
  request: {
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
    method: "POST",
    header: [{ key: "Content-Type", value: "application/json" }],
    body: { mode: "raw", raw: JSON.stringify({ terms_accepted: true, terms_version: "v1", registration_source: "SOCIAL" }, null, 2) },
    url: "{{baseUrl}}/auth/sync",
    description:
      "Run after issuing the regular-user mock token. Saves targetUserId for admin assignment, status, and authorization demonstrations.",
  },
};
const existingRegularSync = auth.item.find((item) => item.name === regularSync.name);
if (existingRegularSync) Object.assign(existingRegularSync, regularSync);
else
  auth.item.splice(
    auth.item.findIndex((item) => item.name === "GET /api/v1/auth/me"),
    0,
    regularSync,
  );

for (const [channel, source, identifier, tokenVariable, userVariable] of [
  ["email", "EMAIL", "email", "mockEmailApiAccessToken", "emailUserId"],
  ["phone", "PHONE", "phone_number", "mockPhoneApiAccessToken", "phoneUserId"],
]) {
  const syncName = `POST /api/v1/auth/sync (${channel} demo user)`;
  const syncRequest = {
    name: syncName,
    event: script(["if (pm.response.code === 200) {", "  const body = pm.response.json();", `  if (body?.data?.user?.id) pm.environment.set('${userVariable}', body.data.user.id);`, "  pm.test('Passwordless identity synced', function () { pm.response.to.have.status(200); });", "}"]),
    request: {
      auth: { type: "bearer", bearer: [{ key: "token", value: `{{${tokenVariable}}}`, type: "string" }] },
      method: "POST", header: [{ key: "Content-Type", value: "application/json" }],
      body: { mode: "raw", raw: JSON.stringify({ terms_accepted: true, terms_version: "v1", registration_source: source }, null, 2) },
      url: "{{baseUrl}}/auth/sync",
      description: `Creates/refreshes the local ${channel} demo account from the signed mock token. The local fixture asserts a verified claim; it is not real ${channel} verification.`,
    },
  };
  const index = auth.item.findIndex((item) => item.name === "GET /api/v1/auth/me");
  const old = auth.item.findIndex((item) => item.name === syncName);
  if (old >= 0) auth.item.splice(old, 1);
  auth.item.splice(index < 0 ? auth.item.length : index, 0, syncRequest);
}
for (const [channel, tokenVariable, userVariable] of [
  ["email", "mockEmailApiAccessToken", "emailUserId"],
  ["phone", "mockPhoneApiAccessToken", "phoneUserId"],
]) {
  const name = `GET /api/v1/auth/me (${channel} demo identity)`;
  const meRequest = {
    name,
    event: script([
      "if (pm.response.code === 200) {",
      "  const body = pm.response.json();",
      `  if (body?.data?.user?.id) pm.environment.set('${userVariable}', body.data.user.id);`,
      `  pm.test('${channel} identity is active', function () { pm.expect(body?.data?.user?.status).to.eql('ACTIVE'); });`,
      "}",
    ]),
    request: {
      auth: { type: "bearer", bearer: [{ key: "token", value: `{{${tokenVariable}}}`, type: "string" }] },
      method: "GET",
      url: "{{baseUrl}}/auth/me",
      description: `Shows the Examinity account created from the mock ${channel} OTP token. This confirms the API sync path only; the mock did not verify a real contact.`,
    },
  };
  const old = auth.item.findIndex((item) => item.name === name);
  if (old >= 0) auth.item.splice(old, 1);
  const syncIndex = auth.item.findIndex((item) => item.name === `POST /api/v1/auth/sync (${channel} demo user)`);
  auth.item.splice(syncIndex < 0 ? auth.item.length : syncIndex + 1, 0, meRequest);
}

const rolesFolder = folder("07 - Role permission write and assignment");
for (const item of rolesFolder.item) {
  if (item.name === "GET /api/v1/roles") {
    item.event = script([
      "if (pm.response.code === 200) {",
      "  const roles = pm.response.json()?.data || [];",
      "  const demo = roles.find(r => r.code === 'DEMO_CUSTOM_ROLE');",
      "  if (demo?.id) pm.environment.set('demoRoleId', demo.id);",
      "  const admin = roles.find(r => r.code === 'ADMIN');",
      "  if (admin?.id) pm.environment.set('roleId', admin.id);",
      "}",
    ]);
  }
  if (item.name === "GET /api/v1/roles/:id" || item.name === "GET /api/v1/roles/:id/permissions")
    item.request.url = "{{baseUrl}}/roles/{{demoRoleId}}" + (item.name.endsWith("/permissions") ? "/permissions" : "");
  if (item.name === "PUT /api/v1/roles/:id/permissions") {
    item.request.url = "{{baseUrl}}/roles/{{demoRoleId}}/permissions";
    item.request.description =
      "Replaces permissions on DEMO_CUSTOM_ROLE, a local non-system role provisioned by client:demo. This request should succeed.";
  }
  if (item.name === "POST /api/v1/users/:id/roles") {
    item.request.url = "{{baseUrl}}/users/{{targetUserId}}/roles";
    item.request.description =
      "SUPER_ADMIN assigns the seeded ADMIN role to the regular demo user. Uses targetUserId captured by regular-user sync.";
  }
  if (item.name === "DELETE /api/v1/users/:id/roles/:roleId") item.request.url = "{{baseUrl}}/users/{{targetUserId}}/roles/{{roleId}}";
}

const userFolder4 = folder("06 - Users and ID administration");
for (const item of userFolder4.item) {
  if (item.name.includes("/disable") || item.name.includes("/enable")) {
    item.request.url = item.request.url.replace("{{userId}}", "{{targetUserId}}");
    item.request.description = "Admin action against the regular demo user. Run enable after disable.";
  }
}

const platform = folder("08 - Configuration and feature flags");
const getLocale = platform.item.find((item) => item.name === "GET /api/v1/configurations/default_locale");
getLocale.event = script([
  "if (pm.response.code === 200) {",
  "  const body = pm.response.json();",
  "  pm.environment.set('configurationVersion', body?.data?.version ?? 1);",
  "}",
]);
platform.item.find((item) => item.name === "PUT /api/v1/configurations/default_locale").request.body.raw = JSON.stringify(
  { value: "en-IN", expected_version: "{{configurationVersion}}" },
  null,
  2,
).replace('"{{configurationVersion}}"', "{{configurationVersion}}");

const mediaFolder = folder("10 - Media");
const presign = mediaFolder.item.find((item) => item.name === "POST /api/v1/media/presign");
presign.event = script([
  "if (pm.response.code === 200 || pm.response.code === 201) {",
  "  const body = pm.response.json();",
  "  if (body?.data?.media_id) pm.environment.set('mediaId', body.data.media_id);",
  "  pm.test('Local media presign succeeded', function () { pm.expect(body?.data?.media_id).to.be.a('string'); });",
  "}",
]);

collection.item = collection.item.filter((item) => item.name !== "11 - Regular user authorization checks" && item.name !== "09 - Regular user authorization checks");
collection.item.push({
  name: "11 - Regular user authorization checks",
  description:
    "Expected results: regular-user calls requiring administrative permissions return 403. Run after both tokens are issued and both identities are synced.",
  item: [
    {
      name: "GET /api/v1/users (expected 403)",
      event: script(["pm.test('Regular user cannot list all users', function () { pm.response.to.have.status(403); });"]),
      request: {
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
        method: "GET",
        url: "{{baseUrl}}/users?page=1&page_size=20",
        description: "Expected 403. Demonstrates that the regular mock user lacks user.read.",
      },
    },
    {
      name: "GET /api/v1/audit-logs (expected 403)",
      event: script(["pm.test('Regular user cannot read audit logs', function () { pm.response.to.have.status(403); });"]),
      request: {
        auth: { type: "bearer", bearer: [{ key: "token", value: "{{mockUserApiAccessToken}}", type: "string" }] },
        method: "GET",
        url: "{{baseUrl}}/audit-logs?page=1&page_size=20",
        description: "Expected 403. Demonstrates administrative audit access is permission protected.",
      },
    },
  ],
});

const variables = [
  ["mockAdminApiAccessToken", "", "Short-lived mock SUPER_ADMIN token; set by the frozen demo collection."],
  ["mockUserApiAccessToken", "", "Short-lived regular mock user token; set by the frozen demo collection."],
  ["mockEmailOtpCode", "", "Short-lived local mock OTP; response displays it because no email is sent."],
  ["mockEmailApiAccessToken", "", "Short-lived passwordless email fixture token from the loopback mock issuer."],
  ["mockPhoneOtpCode", "", "Short-lived local mock OTP; response displays it because no SMS is sent."],
  ["mockPhoneApiAccessToken", "", "Short-lived passwordless phone fixture token from the loopback mock issuer."],
  ["emailUserId", "", "Internal UUID captured when the mock email identity is synced."],
  ["phoneUserId", "", "Internal UUID captured when the mock phone identity is synced."],
  ["targetUserId", "", "Internal UUID captured when the regular mock user is synced."],
  ["demoRoleId", "", "ID of the local non-system DEMO_CUSTOM_ROLE."],
  ["configurationVersion", "1", "Current configuration version captured by the GET request."],
  ["mediaId", "", "ID captured from the local mock media presign request."],
];
for (const [key, value, description] of variables) {
  const existing = environment.values.find((item) => item.key === key);
  if (existing) Object.assign(existing, { value, description, enabled: true });
  else environment.values.push({ key, value, type: "default", enabled: true, description });
}
environment.values = environment.values.filter((item) => item.key !== "mockApiAccessToken");

writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);
console.log("Updated frozen Postman collection and demo environment.");
