import assert from "node:assert/strict";
import { MediaService, detectMediaMimeType } from "../src/media/media.service";

test("detects only the explicitly supported file signatures", () => {
  assert.equal(detectMediaMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectMediaMimeType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(detectMediaMimeType(new TextEncoder().encode("RIFFxxxxWEBP")), "image/webp");
  assert.equal(detectMediaMimeType(new TextEncoder().encode("%PDF-1.7")), "application/pdf");
  assert.equal(detectMediaMimeType(new TextEncoder().encode("<script>")), null);
});

test("a disabled media upload flag blocks presigning before storage is accessed", async () => {
  const prisma = { featureFlag: { findUnique: async () => ({ enabled: false }) } };
  const service = new MediaService(prisma as never, {} as never);
  await assert.rejects(
    () =>
      service.presign(
        { id: "user-1", roles: [] } as never,
        {
          original_filename: "sample.pdf",
          mime_type: "application/pdf",
          file_size_bytes: 100,
          visibility: "PRIVATE",
        } as never,
        { requestId: "request-1" },
        "idempotency-1",
      ),
    (error: unknown) => (error as { getStatus(): number }).getStatus() === 409,
  );
});
