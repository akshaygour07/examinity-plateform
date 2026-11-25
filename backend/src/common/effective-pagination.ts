import { UnprocessableEntityException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service";
import type { PageQueryDto } from "./page-query.dto";

/**
 * Coerces a JSONB configuration value to a valid positive integer within [1, 100],
 * returning `fallback` when the value is absent, non-integer, or out of range.
 */
const safeInteger = (value: unknown, fallback: number) =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100 ? Number(value) : fallback;

/**
 * Reads the `pagination_default_page_size` and `pagination_max_page_size`
 * configuration keys from the database and returns validated, capped page
 * parameters for the current request.
 *
 * Two database reads are made in parallel on every call so that administrators
 * can change pagination limits at runtime without a code deployment.
 * In-process caching is intentionally omitted; the values are small reads
 * against an indexed unique key and will be served from PostgreSQL's shared
 * buffer cache in practice.
 *
 * @param prisma  - A `PrismaService` instance or a Prisma transaction client
 *                  (both expose the `configuration` model accessor).
 * @param query   - The inbound `page` / `page_size` request parameters.
 * @returns       Resolved `{ page, page_size }` ready to pass to Prisma
 *                `skip` / `take`.
 * @throws        `UnprocessableEntityException` (HTTP 422) when the requested
 *                `page_size` exceeds the configured maximum.
 */
export async function effectivePagination(prisma: Pick<PrismaService, "configuration">, query: PageQueryDto) {
  const [defaultRow, maximumRow] = await Promise.all([
    prisma.configuration.findUnique({ where: { configKey: "pagination_default_page_size" }, select: { valueJson: true } }),
    prisma.configuration.findUnique({ where: { configKey: "pagination_max_page_size" }, select: { valueJson: true } }),
  ]);
  const maximum = safeInteger(maximumRow?.valueJson, 100);
  const defaultSize = Math.min(safeInteger(defaultRow?.valueJson, 20), maximum);
  const pageSize = query.page_size ?? defaultSize;
  if (pageSize > maximum)
    throw new UnprocessableEntityException({
      code: "page_size_exceeds_configured_maximum",
      message: "page_size exceeds the configured maximum.",
    });
  return { page: query.page, page_size: pageSize };
}
