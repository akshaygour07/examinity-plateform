import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Prisma Client generation does not need a live database. Migrations still require DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://examinity:examinity@localhost:5432/examinity" }
});
