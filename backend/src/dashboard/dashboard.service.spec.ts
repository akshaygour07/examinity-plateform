import assert from "node:assert/strict";
import { DashboardService } from "./dashboard.service";

test("builds navigation from active roles and permissions and chooses a profile name", async () => {
  const prisma = {
    user: {
      findUnique: async () => ({
        id: "u1",
        status: "ACTIVE",
        emailVerified: true,
        phoneVerified: false,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.test",
        phoneE164: null,
        profile: null,
        assignments: [
          {
            startsAt: null,
            endsAt: null,
            role: {
              active: true,
              permissions: [{ permission: { active: true, code: "admin.users.view" } }, { permission: { active: false, code: "ignored" } }],
            },
          },
        ],
      }),
    },
  };
  const result = await new DashboardService(prisma as never).getForSubject("auth0|ada");
  assert.equal(result.data.welcome_message, "Welcome, Ada Lovelace");
  assert.equal(result.data.profile.profile.locale, "en-IN");
});

test("rejects missing, inactive, and unverified identities", async () => {
  let user: Record<string, unknown> | null = null;
  const service = new DashboardService({ user: { findUnique: async () => user } } as never);
  await assert.rejects(service.getForSubject("missing"));
  user = { status: "DISABLED" };
  await assert.rejects(service.getForSubject("disabled"));
  user = { status: "ACTIVE", emailVerified: false, phoneVerified: false };
  await assert.rejects(service.getForSubject("unverified"));
});

test("returns aggregate admin summary and recent activity", async () => {
  let count = 0;
  const prisma = {
    user: { count: async () => ++count },
    configuration: { count: async () => 3 },
    featureFlag: { count: async () => 2 },
    auditLog: {
      findMany: async () => [
        {
          id: "a1",
          actorUserId: null,
          action: "LOGIN",
          resourceType: "user",
          resourceId: null,
          result: "SUCCESS",
          occurredAt: new Date(0),
        },
      ],
    },
  };
  const result = await new DashboardService(prisma as never).getAdminSummary();
  assert.equal(result.data.users.total, 1);
  assert.equal(result.data.system.enabled_feature_flags, 2);
  assert.equal(result.data.recent_admin_activity[0].id, "a1");
});
