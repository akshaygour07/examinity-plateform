import assert from "node:assert/strict";
import { MediaService, detectMediaMimeType } from "./media.service";

test("detects supported file signatures and rejects unknown bytes", () => {
  assert.equal(detectMediaMimeType(Uint8Array.from([0xff, 0xd8, 0xff])), "image/jpeg");
  assert.equal(detectMediaMimeType(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(detectMediaMimeType(new TextEncoder().encode("%PDF-1.7")), "application/pdf");
  assert.equal(detectMediaMimeType(new TextEncoder().encode("unknown")), null);
});

test("requires a valid idempotency key and enabled uploads", async () => {
  const service = new MediaService({ featureFlag: { findUnique: async () => ({ enabled: false }) } } as never, {} as never);
  await assert.rejects(service.presign({ id: "u", roles: [] } as never, {} as never, { requestId: "r" }, "bad key"));
  await assert.rejects(service.presign({ id: "u", roles: [] } as never, {} as never, { requestId: "r" }, "valid-key"));
});

test("rejects missing and non-owned media during completion", async () => {
  let asset: Record<string, unknown> | null = null;
  const service = new MediaService({ mediaAsset: { findUnique: async () => asset } } as never, {} as never);
  await assert.rejects(service.complete({ id: "u", roles: [] } as never, "missing", { requestId: "r" }));
  asset = { uploadedBy: "other", status: "PENDING" };
  await assert.rejects(service.complete({ id: "u", roles: [] } as never, "m", { requestId: "r" }));
});
