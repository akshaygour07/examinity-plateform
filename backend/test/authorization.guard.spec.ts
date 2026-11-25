import assert from "node:assert/strict";
import { AuthorizationGuard } from "../src/auth/authorization.guard";

function makeContext(user: unknown, emailVerified = true, phoneVerified = false) {
  process.env.AUTH0_ADMIN_CLIENT_ID = "admin-client-test";
  const request = {
    auth0: {
      sub: "auth0|actor",
      email_verified: emailVerified,
      phone_number_verified: phoneVerified,
      azp: "admin-client-test",
      amr: ["pwd", "mfa"],
    },
    method: "GET",
    path: "/api/v1/users",
    headers: {},
    id: "req-test",
  };
  const prisma = { user: { findUnique: async () => user } };
  const auditCalls: unknown[] = [];
  const audit = {
    record: async (entry: unknown) => {
      auditCalls.push(entry);
    },
  };
  const reflector = { getAllAndOverride: () => ["user.read"] };
  const guard = new AuthorizationGuard(reflector as never, prisma as never, audit as never);
  const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => request }) };
  return { guard, context, request, auditCalls };
}

test("resolves effective active roles and permissions for an active user", async () => {
  const { guard, context, request } = makeContext({
    id: "user-1",
    auth0Subject: "auth0|actor",
    status: "ACTIVE",
    assignments: [
      {
        status: "ACTIVE",
        startsAt: null,
        endsAt: null,
        role: { active: true, code: "ADMIN", permissions: [{ permission: { active: true, code: "user.read" } }] },
      },
    ],
  });
  assert.equal(await guard.canActivate(context as never), true);
  assert.equal((request as typeof request & { principal?: { id: string } }).principal?.id, "user-1");
});

test("denies a user with no required permission and records ACCESS_DENIED", async () => {
  const { guard, context, auditCalls } = makeContext({ id: "user-1", auth0Subject: "auth0|actor", status: "ACTIVE", assignments: [] });
  await assert.rejects(
    () => guard.canActivate(context as never),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 403,
  );
  assert.equal(auditCalls.length, 1);
  assert.equal((auditCalls[0] as { action: string }).action, "ACCESS_DENIED");
});

test("denies unknown and disabled identities", async () => {
  const unknown = makeContext(null);
  await assert.rejects(
    () => unknown.guard.canActivate(unknown.context as never),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 403,
  );
  const disabled = makeContext({ id: "user-1", auth0Subject: "auth0|actor", status: "DISABLED", assignments: [] });
  await assert.rejects(
    () => disabled.guard.canActivate(disabled.context as never),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 403,
  );
});

test("denies an active user with neither verified Auth0 email nor phone", async () => {
  const { guard, context, auditCalls } = makeContext(
    { id: "user-1", auth0Subject: "auth0|actor", status: "ACTIVE", assignments: [] },
    false,
  );
  await assert.rejects(
    () => guard.canActivate(context as never),
    (error: unknown) => (error as { response: { code: string } }).response.code === "identity_verification_required",
  );
  assert.equal((auditCalls[0] as { metadata: { reason: string } }).metadata.reason, "identity_verification_required");
});

test("allows an active user with a verified Auth0 phone", async () => {
  const { guard, context } = makeContext(
    {
      id: "user-1",
      auth0Subject: "auth0|actor",
      status: "ACTIVE",
      assignments: [
        {
          status: "ACTIVE",
          startsAt: null,
          endsAt: null,
          role: { active: true, code: "AUTHENTICATED_USER", permissions: [{ permission: { active: true, code: "user.read" } }] },
        },
      ],
    },
    false,
    true,
  );
  assert.equal(await guard.canActivate(context as never), true);
});

test("requires the dedicated admin Auth0 application and completed MFA", async () => {
  const user = {
    id: "user-1",
    auth0Subject: "auth0|actor",
    status: "ACTIVE",
    assignments: [
      {
        status: "ACTIVE",
        startsAt: null,
        endsAt: null,
        role: { active: true, code: "ADMIN", permissions: [{ permission: { active: true, code: "user.read" } }] },
      },
    ],
  };
  const noMfa = makeContext(user);
  (noMfa.request.auth0 as Record<string, unknown>).amr = ["pwd"];
  await assert.rejects(
    () => noMfa.guard.canActivate(noMfa.context as never),
    (error: unknown) => (error as { response: { code: string } }).response.code === "mfa_required",
  );
  const wrongClient = makeContext(user);
  (wrongClient.request.auth0 as Record<string, unknown>).azp = "public-client-test";
  await assert.rejects(
    () => wrongClient.guard.canActivate(wrongClient.context as never),
    (error: unknown) => (error as { response: { code: string } }).response.code === "admin_application_required",
  );
});
