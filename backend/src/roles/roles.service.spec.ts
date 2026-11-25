import assert from "node:assert/strict";
import { RolesService } from "./roles.service";

test("rejects unavailable roles", async () => {
  const service = new RolesService({ role: { findUnique: async () => null } } as never, {} as never);
  await assert.rejects(service.get("missing"));
});

test("replaces role permissions transactionally and records changes", async () => {
  let deleted = false;
  let created: unknown;
  let audited = false;
  const tx = {
    role: {
      findUnique: async () => ({
        id: "r1",
        code: "EDITOR",
        active: true,
        systemRole: false,
        protectedRole: false,
        permissions: [{ permissionId: "old", permission: { code: "old.code" } }],
      }),
    },
    permission: { findMany: async () => [{ id: "new", code: "new.code" }] },
    rolePermission: {
      deleteMany: async () => {
        deleted = true;
      },
      createMany: async ({ data }: { data: unknown }) => {
        created = data;
      },
    },
  };
  const service = new RolesService(
    { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } as never,
    {
      record: async () => {
        audited = true;
      },
    } as never,
  );
  const result = await service.replacePermissions(
    { id: "admin", permissions: ["new.code"] } as never,
    "r1",
    { permission_ids: ["new"] } as never,
    { requestId: "req" },
  );
  assert.equal(deleted, true);
  assert.deepEqual(created, [{ roleId: "r1", permissionId: "new" }]);
  assert.equal(audited, true);
  assert.deepEqual(result.data.permission_ids, ["new"]);
});

test("blocks permission grants the actor cannot delegate", async () => {
  const tx = {
    role: { findUnique: async () => ({ id: "r", code: "CUSTOM", active: true, systemRole: false, protectedRole: false, permissions: [] }) },
    permission: { findMany: async () => [{ id: "p", code: "secret" }] },
  };
  const service = new RolesService(
    { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } as never,
    {} as never,
  );
  await assert.rejects(
    service.replacePermissions({ id: "u", permissions: [] } as never, "r", { permission_ids: ["p"] } as never, { requestId: "req" }),
  );
});
