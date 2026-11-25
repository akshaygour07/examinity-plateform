import assert from "node:assert/strict";
import { UsersService } from "./users.service";

test("returns 403 when the principal lacks admin.users.view", async () => {
  const prisma = {};
  const service = new UsersService(prisma as never, {} as never, {} as never);
  await assert.rejects(
    () =>
      service.list({ id: "learner-1", subject: "auth0|learner", status: "ACTIVE", roles: [], permissions: [] } as never, {
        page: 1,
        page_size: 20,
      }),
    (error: unknown) => {
      assert.equal((error as { status: number }).status, 403);
      return true;
    },
  );
});

test("applies the documented user ID, name, and email filters together", async () => {
  let capturedWhere: Record<string, unknown> | undefined;
  const prisma = {
    user: {
      count: async (args: { where: Record<string, unknown> }) => {
        capturedWhere = args.where;
        return 0;
      },
      findMany: async (args: { where: Record<string, unknown> }) => {
        capturedWhere = args.where;
        return [];
      },
    },
    configuration: {
      findUnique: async ({ where }: { where: { configKey: string } }) => ({ valueJson: where.configKey.endsWith("maximum") ? 100 : 20 }),
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const service = new UsersService(prisma as never, {} as never, {} as never);

  await service.list(
    { id: "admin-1", subject: "auth0|admin", status: "ACTIVE", roles: ["ADMIN"], permissions: ["admin.users.view"] } as never,
    {
      page: 1,
      page_size: 20,
      user_id: "11111111-1111-4111-8111-111111111111",
      name: "Aarav",
      email: "AARAV@example.test",
    },
  );

  assert.equal(capturedWhere?.id, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(capturedWhere?.AND, [
    { OR: [{ firstName: { contains: "Aarav", mode: "insensitive" } }, { lastName: { contains: "Aarav", mode: "insensitive" } }] },
    { emailNormalized: { contains: "aarav@example.test", mode: "insensitive" } },
  ]);
});

test("notification preferences are self-service only", async () => {
  const service = new UsersService({} as never, {} as never, {} as never);
  await assert.rejects(
    () => service.getPreferences({ id: "user-1", roles: [], permissions: [] } as never, "user-2"),
    (error: unknown) => {
      assert.equal((error as { status: number }).status, 403);
      return true;
    },
  );
});

test("status audit events include the affected user for target-user filtering", async () => {
  let recordedMetadata: Record<string, unknown> | undefined;
  const transactionClient = {
    user: {
      findUnique: async () => ({ id: "target-1", status: "ACTIVE", suspensionCategory: null, assignments: [] }),
      count: async () => 2,
      update: async () => ({ id: "target-1", status: "DISABLED" }),
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) => callback(transactionClient),
    user: { findUnique: async () => ({ id: "target-1", profile: { displayName: "Target" } }) },
  };
  const audit = {
    record: async (input: { metadata: Record<string, unknown> }) => {
      recordedMetadata = input.metadata;
    },
  };
  const email = { sendToUser: async () => undefined };
  const service = new UsersService(prisma as never, audit as never, email as never);

  await service.setStatus(
    { id: "admin-1", roles: ["SUPER_ADMIN"], permissions: ["admin.users.status.update"] } as never,
    "target-1",
    { status: "DISABLED", reason: "Policy review completed" },
    { requestId: "req-test" },
  );

  assert.deepEqual(recordedMetadata, {
    target_user_id: "target-1",
    before_data: { status: "ACTIVE", suspension_category: null },
    after_data: { status: "DISABLED", suspension_category: null },
    reason: "Policy review completed",
  });
});

test("prevents a user from granting any role to themselves", async () => {
  const service = new UsersService({ role: { findUnique: async () => ({ code: "CONTENT_ADMIN" }) } } as never, {} as never, {} as never);
  await assert.rejects(
    () =>
      service.assignRole(
        { id: "user-1", roles: [], permissions: [] } as never,
        "user-1",
        { role_id: "role-1", reason: "Test assignment" },
        { requestId: "req-test" },
      ),
    (error: unknown) => {
      assert.equal((error as { status: number }).status, 403);
      assert.equal((error as { response: { code: string } }).response.code, "self_role_assignment_denied");
      return true;
    },
  );
});
