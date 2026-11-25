import assert from "node:assert/strict";
import { effectivePagination } from "../src/common/effective-pagination";

function settings(defaultSize: number, maxSize: number) {
  return {
    configuration: {
      findUnique: async ({ where }: { where: { configKey: string } }) => ({
        valueJson: where.configKey === "pagination_default_page_size" ? defaultSize : maxSize,
      }),
    },
  } as never;
}

test("uses the persisted pagination default when page_size is omitted", async () => {
  assert.deepEqual(await effectivePagination(settings(7, 30), { page: 2 }), { page: 2, page_size: 7 });
});

test("rejects explicit page sizes above the persisted maximum", async () => {
  await assert.rejects(
    () => effectivePagination(settings(7, 10), { page: 1, page_size: 11 }),
    (error: unknown) =>
      (error as { getStatus(): number; getResponse(): { code: string } }).getStatus() === 422 &&
      (error as { getResponse(): { code: string } }).getResponse().code === "page_size_exceeds_configured_maximum",
  );
});
