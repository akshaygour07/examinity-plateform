import assert from "node:assert/strict";
import { AuthService } from "./auth.service";

function harness(initialUser?: Record<string, unknown>) {
  let user: Record<string, unknown> | undefined = initialUser ? { version: 1, ...initialUser } : undefined;
  let profile: Record<string, unknown> | undefined;
  let preferences: Record<string, unknown> | undefined;
  let assignment: Record<string, unknown> | undefined;
  const auditEvents: Array<Record<string, unknown>> = [];

  const prismaState = {
    user: {
      findUnique: async () =>
        user
          ? {
              ...user,
              profile,
              assignments: assignment
                ? [
                    {
                      ...assignment,
                      startsAt: null,
                      endsAt: null,
                      role: { code: "AUTHENTICATED_USER", active: true, permissions: [] },
                    },
                  ]
                : [],
            }
          : null,
      upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        if (!user) {
          user = { id: "internal-user-uuid", version: 1, ...args.create };
        } else {
          const version = user.version as number;
          user = { ...user, ...args.update, version: version + 1 };
        }
        return { ...user };
      },
    },
    role: { findUnique: async () => ({ id: "authenticated-user-role" }) },
    userRoleAssignment: {
      upsert: async (args: { create: Record<string, unknown> }) => {
        assignment ??= { id: "assignment-uuid", ...args.create };
        return assignment;
      },
    },
    userProfile: {
      upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        profile = profile ? { ...profile, ...args.update } : { ...args.create };
        return profile;
      },
    },
    emailPreference: {
      upsert: async (args: { create: Record<string, unknown> }) => {
        preferences ??= { ...args.create };
        return preferences;
      },
    },
    termsAcceptance: {
      createMany: async () => ({ count: 1 }),
    },
    configuration: { findUnique: async () => null, findMany: async () => [] },
    $transaction: async <T>(work: (tx: never) => Promise<T>) => work(prismaState as never),
  };
  const audit = { record: async (event: Record<string, unknown>) => void auditEvents.push(event) };
  const service = new AuthService(prismaState as never, audit as never);
  return { service, auditEvents, snapshot: () => ({ user, profile, preferences, assignment }) };
}

const termsBody = { terms_accepted: true as const, terms_version: "v1", registration_source: "EMAIL" as const };

test("first sync creates a local user, profile, preferences, and only the baseline role", async () => {
  const state = harness();
  const result = await state.service.sync(
    {
      sub: "auth0|new-user",
      email: "student@example.com",
      email_verified: true,
      name: "Exam Student",
      given_name: "Exam",
      family_name: "Student",
      phone_number: "+919876543210",
      phone_number_verified: true,
    },
    { requestId: "req-test" },
    termsBody,
  );

  assert.equal(result.data.user.id, "internal-user-uuid");
  assert.equal(result.data.user.email, "student@example.com");
  assert.deepEqual(result.data.roles, ["AUTHENTICATED_USER"]);
  assert.deepEqual(result.data.permissions, []);
  assert.equal(state.snapshot().user?.emailNormalized, "student@example.com");
  assert.equal(state.snapshot().user?.phoneE164, "+919876543210");
  assert.equal(state.snapshot().profile?.displayName, "Exam Student");
  assert.ok(state.snapshot().preferences);
  assert.equal(state.snapshot().assignment?.roleId, "authenticated-user-role");
  assert.deepEqual(
    state.auditEvents.map((event) => event.action),
    ["LOGIN_SUCCESS", "USER_CREATED"],
  );
});

test("repeat sync keeps the same internal identity and does not add another role assignment", async () => {
  const state = harness();
  const claims = { sub: "auth0|new-user", email: "student@example.com", email_verified: true };
  const first = await state.service.sync(claims, { requestId: "req-test" }, termsBody);
  const second = await state.service.sync({ ...claims, name: "Updated Name" }, { requestId: "req-test" }, termsBody);

  assert.equal(second.data.user.id, first.data.user.id);
  assert.deepEqual(second.data.roles, ["AUTHENTICATED_USER"]);
  assert.equal(state.snapshot().profile?.displayName, "Updated Name");
  assert.equal(state.auditEvents.filter((event) => event.action === "USER_CREATED").length, 1);
});

test("concurrent first syncs converge on the same internal user and baseline role", async () => {
  const state = harness();
  const claims = { sub: "auth0|concurrent", email: "concurrent@example.com", email_verified: true };
  const [first, second] = await Promise.all([
    state.service.sync(claims, { requestId: "req-test" }, termsBody),
    state.service.sync(claims, { requestId: "req-test" }, termsBody),
  ]);

  assert.equal(first.data.user.id, second.data.user.id);
  assert.deepEqual(first.data.roles, ["AUTHENTICATED_USER"]);
  assert.deepEqual(second.data.roles, ["AUTHENTICATED_USER"]);
  assert.equal(state.auditEvents.filter((event) => event.action === "USER_CREATED").length, 1);
});

test("first sync stores an unverified identity as PENDING with no role", async () => {
  const state = harness();
  const result = await state.service.sync(
    { sub: "auth0|unverified", email: "student@example.com", email_verified: false },
    { requestId: "req-test" },
    termsBody,
  );
  assert.equal(result.data.user.status, "PENDING");
  assert.deepEqual(result.data.roles, []);
  assert.equal(state.snapshot().assignment, undefined);
});

test("first sync requires Terms acceptance, version, and registration_source", async () => {
  const state = harness();
  await assert.rejects(() =>
    state.service.sync({ sub: "auth0|new-user", email: "student@example.com", email_verified: true }, { requestId: "req-test" }, {}),
  );
  assert.equal(state.snapshot().user, undefined);
});

test("sync never reactivates a disabled account", async () => {
  const state = harness({ id: "disabled-user", status: "DISABLED", auth0Subject: "auth0|disabled", email: "old@example.com" });
  await assert.rejects(() => state.service.sync({ sub: "auth0|disabled", email: "old@example.com", email_verified: true }));
  assert.equal(state.snapshot().user?.status, "DISABLED");
});

test("current-user lookup denies an unresolved identity", async () => {
  const state = harness();
  await assert.rejects(() => state.service.currentUser({ sub: "auth0|unmapped" }));
});
