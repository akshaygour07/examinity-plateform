import assert from "node:assert/strict";
import { PrismaService } from "./prisma.service";

test("requires DATABASE_URL before constructing the Prisma client", () => {
  const previous = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.throws(() => new PrismaService(), /DATABASE_URL is required/);
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});
