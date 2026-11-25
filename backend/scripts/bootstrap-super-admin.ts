import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { AuditService } from "../src/audit/audit.service";

const databaseUrl = process.env.DATABASE_URL;
const subject = process.env.BOOTSTRAP_AUTH0_SUB?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!subject || subject.length > 255) throw new Error("Set BOOTSTRAP_AUTH0_SUB to the verified Auth0 sub of the active user");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const audit = new AuditService(prisma as never);

async function main() {
  await prisma.$transaction(async (tx) => {
    // Serialize one-time bootstrap attempts so two operators cannot create separate first admins.
    // Prisma cannot decode PostgreSQL's `void` result, so return a boolean while still acquiring the transaction lock.
    await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_advisory_xact_lock(731905, 1) IS NULL AS locked`;
    const now = new Date();
    const activeSuperAdmins = await tx.userRoleAssignment.count({
      where: {
        status: "ACTIVE",
        role: { code: "SUPER_ADMIN", active: true },
        user: { status: "ACTIVE" },
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
    });
    if (activeSuperAdmins > 0) throw new Error("An active SUPER_ADMIN already exists; bootstrap is disabled");

    const user = await tx.user.findUnique({ where: { auth0Subject: subject } });
    if (!user || user.status !== "ACTIVE" || !user.emailVerified)
      throw new Error("The Auth0 subject must belong to an active, email-verified Examinity user");
    const role = await tx.role.findUnique({ where: { code: "SUPER_ADMIN" } });
    if (!role || !role.active || !role.systemRole) throw new Error("The active system SUPER_ADMIN role is not seeded");
    const priorAssignment = await tx.userRoleAssignment.findUnique({ where: { userId_roleId: { userId: user.id, roleId: role.id } } });
    if (priorAssignment) throw new Error("This user already has a SUPER_ADMIN assignment record; review it manually");

    const assignment = await tx.userRoleAssignment.create({
      data: { userId: user.id, roleId: role.id, status: "ACTIVE" },
    });
    await audit.record(
      {
        actorUserId: null,
        action: "ROLE_ASSIGNED",
        resourceType: "user_role_assignment",
        resourceId: assignment.id,
        requestId: "bootstrap-super-admin",
        result: "SUCCESS",
        metadata: { role_code: "SUPER_ADMIN", target_user_id: user.id, source: "one_time_bootstrap" },
      },
      tx,
    );
  });
  console.info("Initial SUPER_ADMIN role assigned and audited.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Super-admin bootstrap failed");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
