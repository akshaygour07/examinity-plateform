import assert from "node:assert/strict";
import { AuditService } from "./audit.service";

test("persists sanitized request context with append-only audit entries", async () => {
  let data: Record<string, unknown> | undefined;
  const service = new AuditService({
    auditLog: {
      create: async ({ data: entry }: { data: Record<string, unknown> }) => {
        data = entry;
        return entry;
      },
    },
  } as never);

  await service.record({
    actorUserId: null,
    action: "ACCESS_DENIED",
    resourceType: "api_route",
    resourceId: null,
    requestId: "req-test",
    correlationId: "corr-test",
    result: "FAILURE",
    ipAddress: "192.0.2.1",
    userAgent: "A".repeat(510),
  });

  assert.equal(data?.ipAddress, "192.0.2.1");
  assert.equal((data?.userAgent as string).length, 500);
});
