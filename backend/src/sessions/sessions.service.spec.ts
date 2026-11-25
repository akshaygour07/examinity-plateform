import assert from "node:assert/strict";
import { SessionsService } from "./sessions.service";

test("fingerprints tokens and creates a session from verified subject", async () => {
  let created: Record<string, unknown> | undefined;
  const prisma = {
    apiSession: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => (created = { id: "s1", ...data }),
    },
    user: { findUnique: async () => ({ id: "u1" }) },
  };
  const service = new SessionsService(prisma as never, { record: async () => undefined } as never);
  const fingerprint = service.fingerprint("secret-token");
  const session = await service.observeToken({
    subject: "auth0|u",
    token: "secret-token",
    expiresAt: new Date(Date.now() + 60_000),
    request: { headers: { "user-agent": "Mozilla/5.0 Chrome/1" }, ip: "127.0.0.1" } as never,
  });
  assert.equal(fingerprint.length, 64);
  assert.equal(created?.tokenFingerprint, fingerprint);
  assert.equal(session?.browser, "Chrome");
});

test("rejects revoked sessions and returns undefined for unresolved users", async () => {
  const revoked = new SessionsService({ apiSession: { findUnique: async () => ({ status: "REVOKED" }) } } as never, {} as never);
  await assert.rejects(revoked.observeToken({ subject: "s", token: "t", expiresAt: new Date(), request: { headers: {} } as never }));
  const missing = new SessionsService(
    { apiSession: { findUnique: async () => null }, user: { findUnique: async () => null } } as never,
    {} as never,
  );
  assert.equal(
    await missing.observeToken({ subject: "s", token: "t", expiresAt: new Date(), request: { headers: {} } as never }),
    undefined,
  );
});

test("lists formatted sessions, marks current session, and audits list access", async () => {
  let event: Record<string, unknown> | undefined;
  const service = new SessionsService(
    {
      apiSession: {
        findMany: async () => [
          {
            id: "s1",
            status: "ACTIVE",
            device: null,
            browser: null,
            ipAddress: null,
            location: null,
            createdAt: new Date(),
            lastActivityAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
          },
        ],
      },
    } as never,
    {
      record: async (input: Record<string, unknown>) => {
        event = input;
      },
    } as never,
  );
  const result = await service.list("u1", "s1", { requestId: "r" });
  assert.equal(result.data[0].is_current, true);
  assert.equal((event?.metadata as { returned_count: number }).returned_count, 1);
});

test("requires current session before revoking other sessions", async () => {
  const service = new SessionsService({} as never, {} as never);
  await assert.rejects(service.revokeOthers("u", "u", undefined, { requestId: "r" }));
});
