import { readFile, writeFile } from "node:fs/promises";

const files = [
  "postman/Examinity-Module-1-Frozen-API.postman_collection.json",
  "postman/Examinity-Module-1.postman_collection.json",
  "postman/Examinity-Admin-QA.postman_collection.json",
  "postman/Examinity-API.postman_collection.json",
];
const bearer = (key) => ({ type: "bearer", bearer: [{ key: "token", value: `{{${key}}}`, type: "string" }] });
const test = (name, exec, auth, method = "GET", path = "/auth/me", body) => ({
  name,
  request: {
    ...(auth ? { auth: bearer(auth) } : {}),
    method,
    header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
    url: `{{baseUrl}}${path}`,
    ...(body ? { body: { mode: "raw", raw: JSON.stringify(body, null, 2) } } : {}),
  },
  response: [],
  event: [{ listen: "test", script: { type: "text/javascript", exec } }],
});
const issueToken = (label, profile, key) => ({
  name: label,
  request: {
    auth: { type: "noauth" },
    method: "POST",
    header: [{ key: "Content-Type", value: "application/json" }],
    body: { mode: "raw", raw: JSON.stringify({ profile }) },
    url: "{{mockIssuerUrl}}/oauth/token",
    description:
      "Local demo token only. Each issuance has a unique token ID and represents a separate Examinity API session after first use.",
  },
  response: [],
  event: [
    {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: ["pm.response.to.have.status(200);", `pm.environment.set('${key}', pm.response.json().access_token);`],
      },
    },
  ],
});

function sessionFlow({ profile, tokenKey, prefix, route }) {
  const secondToken = `${prefix}SecondaryApiAccessToken`;
  const otherToken = `${prefix}OtherApiAccessToken`;
  const targetId = `${prefix}SessionRevokeTargetId`;
  return [
    issueToken(`Issue second ${profile} demo token`, profile, secondToken),
    test(
      `Register second ${profile} API session`,
      ["pm.test('second token is accepted', () => pm.response.to.have.status(200));"],
      secondToken,
    ),
    test(
      "List sessions and capture the second session",
      [
        "pm.response.to.have.status(200);",
        "const rows = pm.response.json().data;",
        "const target = rows.find(row => !row.is_current && row.status === 'ACTIVE');",
        "pm.test('current and second token sessions are listed', () => { pm.expect(rows.some(row => row.is_current && row.status === 'ACTIVE')).to.eql(true); pm.expect(target).to.be.an('object'); });",
        `if (target) pm.environment.set('${targetId}', target.id);`,
      ],
      tokenKey,
      "GET",
      route,
    ),
    test(
      "Read the selected session",
      [
        "pm.response.to.have.status(200);",
        `pm.test('session is owned by current user', () => pm.expect(pm.response.json().data.id).to.eql(pm.environment.get('${targetId}')));`,
      ],
      tokenKey,
      "GET",
      `${route}/{{${targetId}}}`,
    ),
    test(
      "Revoke the selected session",
      [
        "pm.response.to.have.status(200);",
        "pm.test('session revoked', () => pm.expect(pm.response.json().data.status).to.eql('REVOKED'));",
      ],
      tokenKey,
      "DELETE",
      `${route}/{{${targetId}}}`,
    ),
    test(
      "Verify the revoked token is rejected",
      [
        "pm.test('revoked API token is rejected', () => { pm.response.to.have.status(403); pm.expect(pm.response.json().error.code).to.eql('session_revoked'); });",
      ],
      secondToken,
    ),
    issueToken(`Issue third ${profile} demo token`, profile, otherToken),
    test(`Register third ${profile} API session`, ["pm.response.to.have.status(200);"], otherToken),
    test(
      "Revoke all other sessions and preserve this token",
      [
        "pm.response.to.have.status(200);",
        "pm.test('one or more other sessions revoked', () => pm.expect(pm.response.json().data.revoked_count).to.be.greaterThan(0));",
      ],
      tokenKey,
      "POST",
      `${route}/revoke-others`,
      { confirmation: true },
    ),
    test(
      "Verify revoke-others invalidated the third token",
      [
        "pm.test('other API token is rejected', () => { pm.response.to.have.status(403); pm.expect(pm.response.json().error.code).to.eql('session_revoked'); });",
      ],
      otherToken,
    ),
    test(
      "Verify the current session remains active",
      [
        "pm.response.to.have.status(200);",
        "pm.test('current API session remains active', () => pm.expect(pm.response.json().data.find(row => row.is_current).status).to.eql('ACTIVE'));",
      ],
      tokenKey,
      "GET",
      route,
    ),
  ];
}

for (const file of files) {
  const collection = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
  if (collection.info?.description) {
    collection.info.description = collection.info.description
      .replace(
        /ADM-018 sends four registered session routes and asserts their current 503 gap response\. Session operations are in scope but the provider is not implemented\./g,
        "ADM-018 demonstrates Module 1 API-token session listing, detail, revocation, and revoke-others with separate local test tokens.",
      )
      .replace(/ADM-018 session stubs \(503 gap analysis\)/g, "ADM-018 shared API-token sessions");
  }
  const adminFolder = collection.item.find((entry) => entry.item?.some((screen) => screen.name.startsWith("ADM-018")));
  if (adminFolder) {
    const screen = adminFolder.item.find((entry) => entry.name.startsWith("ADM-018"));
    screen.name = "ADM-018 My Sessions";
    screen.description =
      "Session security screen for the signed-in administrator. Runs an end-to-end two-token exercise against the admin aliases for the shared Module 1 Examinity API-token session service. Tokens are revoked for future API calls; this does not terminate Auth0 SSO or a frontend/BFF cookie session.";
    screen.item = sessionFlow({ profile: "admin", tokenKey: "mockAdminApiAccessToken", prefix: "admin", route: "/me/sessions" });
  }

  {
    if (!collection.info.description?.includes("runnable Module 1 self-service API session exercise"))
      collection.info.description = `${collection.info.description ?? ""} Includes a runnable Module 1 self-service API session exercise: register separate local test-user tokens, list/detail/revoke sessions, and verify revoke-others. API-token revocation blocks Examinity API use; browser/BFF and Auth0 SSO logout are client responsibilities.`;
    collection.item = collection.item.filter(
      (entry) =>
        ![
          "11 - Module 1 dashboard",
          "12 - External Auth0 phone delivery callback",
          "12 - Session management (Module 1)",
          "13 - Session management (Module 1)",
        ].includes(entry.name),
    );
    collection.item.push({
      name: "11 - Module 1 dashboard",
      description:
        "Authenticated Module 1 landing summary. Navigation is informative only; each API endpoint applies its own authorization.",
      item: [
        test(
          "GET /dashboard — current user landing summary",
          [
            "pm.response.to.have.status(200);",
            "pm.test('dashboard returns profile and navigation', () => { pm.expect(pm.response.json().data).to.be.an('object'); pm.expect(pm.response.json().data.navigation).to.be.an('array'); });",
          ],
          "mockUserApiAccessToken",
          "GET",
          "/dashboard",
        ),
      ],
    });
    collection.item.push({
      name: "12 - External Auth0 phone delivery callback",
      description:
        "Provider callback protected by PHONE_PROVIDER_API_SECRET, not an end-user token. The local demo uses a mock OTP issuer and does not exercise delivery. Keep the secret local; enable only in a configured provider integration environment.",
      item: [
        {
          name: "POST /auth/phone/deliver (disabled; provider integration required)",
          disabled: true,
          request: {
            auth: bearer("phoneProviderApiSecret"),
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ recipient: "+15555550123", code: "123456", message_type: "otp_enroll", locale: "en" }, null, 2),
            },
            url: "{{baseUrl}}/auth/phone/deliver",
            description: "Do not enable in the local mock flow. No delivery is sent and PHONE_PROVIDER_API_SECRET is intentionally blank.",
          },
          response: [],
        },
      ],
    });
    collection.item.push({
      name: "13 - Session management (Module 1)",
      description:
        "Run after local regular-user token setup and identity sync. Each token is observed on first API use. The session API is self-service and never accepts a target user ID.",
      item: sessionFlow({ profile: "user", tokenKey: "mockUserApiAccessToken", prefix: "user", route: "/auth/me/sessions" }),
    });
  }
  await writeFile(file, `${JSON.stringify(collection, null, 2)}\n`);
}

const envPath = "postman/Examinity-Module-1.postman_environment.json";
const environment = JSON.parse(await readFile(envPath, "utf8"));
const variables = [
  ["mockAdminSecondaryApiAccessToken", ""],
  ["mockAdminOtherApiAccessToken", ""],
  ["adminSessionRevokeTargetId", ""],
  ["mockUserSecondaryApiAccessToken", ""],
  ["mockUserOtherApiAccessToken", ""],
  ["userSessionRevokeTargetId", ""],
  ["phoneProviderApiSecret", ""],
];
for (const [key, value] of variables) {
  const existing = environment.values.find((entry) => entry.key === key);
  if (existing) existing.value = value;
  else
    environment.values.push({
      key,
      value,
      type: key === "phoneProviderApiSecret" ? "secret" : "default",
      enabled: true,
      description: "Local Postman walkthrough variable; provider secret remains blank until integration configuration.",
    });
}
const uniqueVariables = new Map();
for (const entry of environment.values) {
  const prior = uniqueVariables.get(entry.key);
  if (!prior) uniqueVariables.set(entry.key, entry);
  else {
    if (!prior.value && entry.value) prior.value = entry.value;
    if (!prior.description && entry.description) prior.description = entry.description;
    if (entry.type === "secret") prior.type = "secret";
  }
}
environment.values = [...uniqueVariables.values()];
await writeFile(envPath, `${JSON.stringify(environment, null, 2)}\n`);
console.log("Added Module 1 and ADM-018 token-session Postman walkthroughs.");
