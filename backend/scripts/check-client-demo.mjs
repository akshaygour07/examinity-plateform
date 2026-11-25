import { randomUUID } from "node:crypto";

const issuer = "http://127.0.0.1:4011";
const api = "http://localhost:4000/api/v1";

async function call(method, path, token, body, headers = {}) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { raw: text };
  }
  const label = `${method} ${path} -> ${response.status}`;
  console.log(label);
  return { status: response.status, body: result };
}

function expectStatus(result, expected, label) {
  if (result.status !== expected) throw new Error(`${label}: expected ${expected}, received ${result.status}`);
  return result.body?.data;
}

async function token(profile) {
  const response = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(`Local ${profile} mock token unavailable (${response.status})`);
  console.log(`POST /oauth/token profile=${profile} -> ${response.status}`);
  return result.access_token;
}

async function passwordlessToken(connection, identifier) {
  const startResponse = await fetch(`${issuer}/mock/passwordless/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection, ...identifier }),
  });
  const challenge = await startResponse.json();
  if (!startResponse.ok || challenge.delivery !== "mock_only" || !challenge.mock_code)
    throw new Error(`Local ${connection} mock OTP start failed (${startResponse.status})`);
  const verifyResponse = await fetch(`${issuer}/mock/passwordless/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connection, ...identifier, code: challenge.mock_code }),
  });
  const result = await verifyResponse.json();
  if (!verifyResponse.ok || !result.access_token) throw new Error(`Local ${connection} mock OTP verify failed (${verifyResponse.status})`);
  console.log(`POST /mock/passwordless/start + verify (${connection}, mock only) -> 200`);
  return result.access_token;
}

async function main() {
  const [adminToken, userToken, emailToken, phoneToken] = await Promise.all([
    token("admin"),
    token("user"),
    passwordlessToken("email", { email: "email.demo@example.test" }),
    passwordlessToken("sms", { phone_number: "+15555550123" }),
  ]);
  const live = await fetch("http://localhost:4000/health/live");
  if (!live.ok) throw new Error("API liveness is unavailable");
  console.log(`GET /health/live -> ${live.status}`);
  const ready = await fetch("http://localhost:4000/health/ready");
  if (!ready.ok) throw new Error(`API readiness is unavailable (${ready.status})`);
  console.log(`GET /health/ready -> ${ready.status}`);

  const adminSync = expectStatus(
    await call("POST", "/auth/sync", adminToken, {
      terms_accepted: true,
      terms_version: "v1",
      registration_source: "SOCIAL",
    }),
    200,
    "Admin sync",
  );
  const adminId = adminSync.user.id;
  const userSync = expectStatus(
    await call("POST", "/auth/sync", userToken, {
      terms_accepted: true,
      terms_version: "v1",
      registration_source: "SOCIAL",
    }),
    200,
    "Regular-user sync",
  );
  const userId = userSync.user.id;
  const emailSync = expectStatus(
    await call("POST", "/auth/sync", emailToken, {
      terms_accepted: true,
      terms_version: "v1",
      registration_source: "EMAIL",
    }),
    200,
    "Email OTP fixture sync",
  );
  const phoneSync = expectStatus(
    await call("POST", "/auth/sync", phoneToken, {
      terms_accepted: true,
      terms_version: "v1",
      registration_source: "PHONE",
    }),
    200,
    "Phone OTP fixture sync",
  );
  if (!emailSync.user.email || !phoneSync.user.phone_e164)
    throw new Error("Passwordless fixture sync did not persist its verified contact claim");
  const me = expectStatus(await call("GET", "/auth/me", adminToken), 200, "Auth me");
  if (!me.roles.includes("SUPER_ADMIN")) throw new Error("Mock admin is missing SUPER_ADMIN");
  const regularMe = expectStatus(await call("GET", "/auth/me", userToken), 200, "Regular-user auth me");
  if (!regularMe.roles.includes("AUTHENTICATED_USER")) throw new Error("Regular user cannot read their own effective role");
  const dashboard = expectStatus(await call("GET", "/admin/dashboard", adminToken), 200, "Admin dashboard");
  if (typeof dashboard.users?.total !== "number") throw new Error("Admin dashboard did not return shared user counts");
  const secondAdminToken = await token("admin");
  expectStatus(await call("GET", "/auth/me", secondAdminToken), 200, "Register second admin API session");
  const sessionList = expectStatus(await call("GET", "/me/sessions", adminToken), 200, "Admin session list");
  const secondAdminSession = sessionList.find((session) => !session.is_current && session.status === "ACTIVE");
  if (!secondAdminSession) throw new Error("Second admin API session was not listed");
  const sessionDetail = expectStatus(await call("GET", `/me/sessions/${secondAdminSession.id}`, adminToken), 200, "Admin session detail");
  if (sessionDetail.id !== secondAdminSession.id) throw new Error("Session detail returned a different session");
  expectStatus(await call("DELETE", `/me/sessions/${secondAdminSession.id}`, adminToken), 200, "Revoke second admin session");
  const revokedSessionUse = await call("GET", "/auth/me", secondAdminToken);
  if (revokedSessionUse.status !== 403 || revokedSessionUse.body?.error?.code !== "session_revoked")
    throw new Error("A revoked admin token remained usable");
  const thirdAdminToken = await token("admin");
  expectStatus(await call("GET", "/auth/me", thirdAdminToken), 200, "Register third admin API session");
  const revokeOthers = expectStatus(
    await call("POST", "/me/sessions/revoke-others", adminToken, { confirmation: true }),
    200,
    "Revoke other admin sessions",
  );
  if (revokeOthers.revoked_count < 1) throw new Error("Revoke-others did not revoke the third admin session");
  const thirdSessionUse = await call("GET", "/auth/me", thirdAdminToken);
  if (thirdSessionUse.status !== 403 || thirdSessionUse.body?.error?.code !== "session_revoked")
    throw new Error("Revoke-others left a different admin token usable");
  const currentSessions = expectStatus(await call("GET", "/me/sessions", adminToken), 200, "Verify current session remains");
  if (!currentSessions.some((session) => session.is_current && session.status === "ACTIVE"))
    throw new Error("Revoke-others did not preserve the current admin session");
  const regularSessions = expectStatus(await call("GET", "/auth/me/sessions", userToken), 200, "Regular user session list");
  if (!regularSessions.some((session) => session.is_current)) throw new Error("Regular user's current session is missing");
  const foreignSession = await call("GET", `/auth/me/sessions/${secondAdminSession.id}`, userToken);
  if (foreignSession.status !== 404 || foreignSession.body?.error?.code !== "session_not_found")
    throw new Error("Regular user could read another user's session");
  const noMfaToken = await token("admin-no-mfa");
  const noMfa = await call("GET", "/users?page=1&page_size=20", noMfaToken);
  if (noMfa.status !== 403 || noMfa.body?.error?.code !== "mfa_required")
    throw new Error(`Admin API accepted a token without MFA (${noMfa.status})`);
  const wrongClientToken = await token("admin-wrong-client");
  const wrongClient = await call("GET", "/users?page=1&page_size=20", wrongClientToken);
  if (wrongClient.status !== 403 || wrongClient.body?.error?.code !== "admin_application_required")
    throw new Error(`Admin API accepted a token from the non-admin application (${wrongClient.status})`);
  expectStatus(await call("GET", "/admin/users?page=1&page_size=20", adminToken), 200, "Admin user list");
  expectStatus(
    await call(
      "GET",
      "/admin/users?page=1&page_size=20&search=demo&status=ACTIVE&mobile_number=555&role_code=ADMIN&email_verified=true&mobile_verified=true&created_from=2026-01-01&created_to=2026-12-31",
      adminToken,
    ),
    200,
    "Admin user filters",
  );
  expectStatus(await call("GET", `/admin/users/${adminId}`, adminToken), 200, "Admin user detail");
  expectStatus(
    await call("PATCH", `/users/${adminId}`, adminToken, {
      first_name: "Demo",
      last_name: "Administrator",
      display_name: "Demo Administrator",
      locale: "en-IN",
      timezone: "Asia/Kolkata",
    }),
    200,
    "Profile update",
  );
  expectStatus(await call("GET", `/users/${adminId}/preferences`, adminToken), 200, "Preferences read");
  expectStatus(
    await call("PATCH", `/users/${adminId}/preferences`, adminToken, {
      transactional_email_enabled: true,
      marketing_email_enabled: false,
      locale: "en-IN",
      language: "en",
      timezone: "Asia/Kolkata",
    }),
    200,
    "Preferences update",
  );
  expectStatus(
    await call("POST", `/users/${userId}/disable`, adminToken, { status: "DISABLED", reason: "Local demo lifecycle check" }),
    201,
    "Disable regular user",
  );
  expectStatus(
    await call("POST", `/users/${userId}/enable`, adminToken, { status: "ACTIVE", reason: "Restore local demo lifecycle check" }),
    201,
    "Enable regular user",
  );
  expectStatus(
    await call("PATCH", `/admin/users/${userId}/status`, adminToken, { status: "DISABLED", reason: "Local demo status contract check" }),
    200,
    "Admin status contract disable",
  );
  expectStatus(
    await call("PATCH", `/admin/users/${userId}/status`, adminToken, {
      status: "ACTIVE",
      reason: "Restore local demo status contract check",
    }),
    200,
    "Admin status contract enable",
  );

  const roles = expectStatus(await call("GET", "/admin/roles?page=1&page_size=100", adminToken), 200, "Admin role list");
  const adminRole = roles.find((item) => item.code === "ADMIN");
  const superAdminRole = roles.find((item) => item.code === "SUPER_ADMIN");
  const demoRole = roles.find((item) => item.code === "DEMO_CUSTOM_ROLE");
  if (!adminRole || !superAdminRole || !demoRole) throw new Error("A required role fixture is missing");
  if (superAdminRole.assignable !== false || superAdminRole.is_protected !== true)
    throw new Error("SUPER_ADMIN is not marked protected and non-assignable");
  const superAdminAssignment = await call("POST", `/users/${userId}/roles`, adminToken, {
    role_id: superAdminRole.id,
    reason: "Negative check: SUPER_ADMIN must not be ordinarily assignable",
  });
  if (superAdminAssignment.status !== 403 || superAdminAssignment.body?.error?.code !== "role_assignment_protected")
    throw new Error("Ordinary role assignment accepted SUPER_ADMIN");
  const roleDetail = expectStatus(await call("GET", `/admin/roles/${demoRole.id}`, adminToken), 200, "Admin role detail");
  if (!Array.isArray(roleDetail.assignment_history)) throw new Error("Admin role detail is missing assignment history");
  const permissions = expectStatus(await call("GET", "/admin/permissions?page=1&page_size=100", adminToken), 200, "Admin permission list");
  if (!permissions.some((permission) => permission.resource && permission.action && permission.is_system === true))
    throw new Error("Permission catalogue is missing the client resource/action fields");
  expectStatus(await call("GET", `/admin/roles/${demoRole.id}/permissions`, adminToken), 200, "Admin role permission list");
  expectStatus(
    await call("PUT", `/admin/roles/${demoRole.id}/permissions`, adminToken, {
      permission_ids: permissions.slice(0, 2).map((permission) => permission.id),
      reason: "Local demo role permission contract check",
    }),
    200,
    "Admin role permission update",
  );
  expectStatus(await call("GET", `/admin/users/${userId}/roles`, adminToken), 200, "Admin user role list");
  expectStatus(
    await call("POST", `/admin/users/${userId}/roles`, adminToken, { role_id: adminRole.id, reason: "Mock contract check" }),
    201,
    "Admin role assignment",
  );
  expectStatus(
    await call("DELETE", `/admin/users/${userId}/roles/${adminRole.id}`, adminToken, {
      reason: "Restore local demo role assignment after contract check",
    }),
    200,
    "Admin role revocation",
  );

  expectStatus(await call("GET", "/admin/settings?page=1&page_size=100", adminToken), 200, "Admin settings list");
  const locale = expectStatus(await call("GET", "/admin/settings/default_locale", adminToken), 200, "Admin setting detail");
  const missingSettingReason = await call("PATCH", "/admin/settings/default_locale", adminToken, {
    value: "en-IN",
    expected_version: locale.version,
  });
  if (
    missingSettingReason.status !== 400 ||
    missingSettingReason.body?.error?.code !== "validation_error" ||
    !missingSettingReason.body?.error?.details?.fields?.some((field) => field.includes("reason"))
  )
    throw new Error("Admin setting update did not require a change reason");
  expectStatus(
    await call("PATCH", "/admin/settings/default_locale", adminToken, {
      value: "en-IN",
      expected_version: locale.version,
      reason: "Mock API contract check",
    }),
    200,
    "Admin setting update",
  );
  expectStatus(await call("GET", "/admin/feature-flags?page=1&page_size=100", adminToken), 200, "Admin feature flag list");
  const flag = expectStatus(await call("GET", "/admin/feature-flags/media_upload_enabled", adminToken), 200, "Admin feature flag detail");
  const missingFlagVersion = await call("PATCH", "/admin/feature-flags/media_upload_enabled", adminToken, { enabled: !flag.enabled });
  if (
    missingFlagVersion.status !== 400 ||
    missingFlagVersion.body?.error?.code !== "validation_error" ||
    !missingFlagVersion.body?.error?.details?.fields?.some((field) => field.includes("expected_version"))
  )
    throw new Error("Admin feature flag update did not require optimistic concurrency");
  const change = expectStatus(
    await call("PATCH", "/admin/feature-flags/media_upload_enabled", adminToken, {
      enabled: !flag.enabled,
      expected_version: flag.version,
      reason: "Local demo feature flag contract check",
    }),
    200,
    "Admin versioned feature flag update",
  );
  const staleFlag = await call("PATCH", "/admin/feature-flags/media_upload_enabled", adminToken, {
    enabled: flag.enabled,
    expected_version: flag.version,
    reason: "Negative check for stale feature flag version",
  });
  if (staleFlag.status !== 409 || staleFlag.body?.error?.code !== "feature_flag_version_conflict")
    throw new Error("Feature flag update did not reject a stale version");
  expectStatus(
    await call("PATCH", "/admin/feature-flags/media_upload_enabled", adminToken, {
      enabled: flag.enabled,
      expected_version: change.version,
      reason: "Restore after local demo feature flag contract check",
    }),
    200,
    "Restore local media flag",
  );

  const audit = expectStatus(await call("GET", "/admin/audit-logs?page=1&page_size=20", adminToken), 200, "Admin audit search");
  expectStatus(
    await call("GET", `/admin/audit-logs?actor_user_id=${adminId}&target_user_id=${userId}&page=1&page_size=20`, adminToken),
    200,
    "Target user activity search",
  );
  if (audit.length) expectStatus(await call("GET", `/admin/audit-logs/${audit[0].id}`, adminToken), 200, "Admin audit detail");

  const media = expectStatus(
    await call(
      "POST",
      "/media/presign",
      adminToken,
      {
        original_filename: "sample.pdf",
        mime_type: "application/pdf",
        file_size_bytes: 12345,
        visibility: "PRIVATE",
      },
      { "Idempotency-Key": randomUUID() },
    ),
    201,
    "Local media presign",
  );
  const mediaId = media.media_id;
  expectStatus(await call("POST", `/media/${mediaId}/complete`, adminToken), 201, "Local media complete");
  expectStatus(await call("GET", `/media/${mediaId}`, adminToken), 200, "Media detail");
  expectStatus(await call("GET", `/media/${mediaId}/download-url`, adminToken), 200, "Media download URL");
  expectStatus(await call("DELETE", `/media/${mediaId}`, adminToken), 200, "Media delete");

  expectStatus(await call("GET", "/users?page=1&page_size=20", userToken), 403, "Regular-user user-list denial");
  expectStatus(await call("GET", "/audit-logs?page=1&page_size=20", userToken), 403, "Regular-user audit denial");
  expectStatus(await call("DELETE", `/users/${userId}/roles/${adminRole.id}`, userToken), 403, "Regular-user role revocation denial");
  expectStatus(
    await call("DELETE", `/admin/users/${userId}/roles/${adminRole.id}`, userToken),
    403,
    "Regular-user admin role revocation denial",
  );
  expectStatus(
    await call("PATCH", `/admin/users/${userId}/status`, userToken, { status: "DISABLED", reason: "Expected authorization denial" }),
    403,
    "Regular-user admin status-change denial",
  );
  expectStatus(
    await call("PUT", `/admin/roles/${demoRole.id}/permissions`, userToken, { permission_ids: [] }),
    403,
    "Regular-user role-permission write denial",
  );
  expectStatus(
    await call("PATCH", "/admin/settings/default_locale", userToken, {
      value: "en-IN",
      expected_version: 1,
      reason: "Negative permission check",
    }),
    403,
    "Regular-user configuration write denial",
  );
  expectStatus(
    await call("PATCH", "/admin/feature-flags/media_upload_enabled", userToken, { enabled: false, expected_version: 1 }),
    403,
    "Regular-user feature flag write denial",
  );
  expectStatus(await call("POST", "/auth/logout", adminToken), 201, "Logout audit and API session revocation");
  const loggedOutTokenUse = await call("GET", "/auth/me", adminToken);
  if (loggedOutTokenUse.status !== 403 || loggedOutTokenUse.body?.error?.code !== "session_revoked")
    throw new Error("Logout did not revoke the current API token session");
  console.log("All local mock API and email/phone passwordless walkthrough checks completed successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Mock API check failed");
  process.exitCode = 1;
});
