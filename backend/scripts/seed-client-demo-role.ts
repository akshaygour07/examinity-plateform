import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const database = new URL(databaseUrl);
if (database.pathname.replace(/^\//, "") !== "examinity")
  throw new Error("The client-demo fixture is restricted to the dedicated examinity database.");
if (process.env.NODE_ENV === "production") throw new Error("Client-demo fixtures are disabled in production.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const role = await prisma.role.upsert({
    where: { code: "DEMO_CUSTOM_ROLE" },
    update: { active: true, systemRole: false },
    create: {
      code: "DEMO_CUSTOM_ROLE",
      name: "Demo Custom Role",
      description: "Local-only role used to demonstrate permission replacement in Postman.",
      systemRole: false,
      active: true,
    },
  });
  console.info(`Local permission-write fixture ready (${role.code}).`);
}

main().finally(() => prisma.$disconnect());
