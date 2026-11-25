/**
 * Examinity platform seed — initial release (D9, D10).
 *
 * What this seed does:
 *  1. Seeds platform configuration catalogue with D4 metadata fields.
 *  2. Seeds feature flags with D5 name + status fields.
 *  3. Seeds email templates.
 *  4. Seeds the approved admin.* permission catalogue (D9).
 *  5. Seeds only approved roles: SUPER_ADMIN, ADMIN, AUTHENTICATED_USER (D10).
 *     Deactivates unapproved future roles: CONTENT_ADMIN, REVIEWER, PUBLISHER.
 *  6. Grants ADMIN the baseline permission set (no reinstate/unlock/write by default).
 *     Grants SUPER_ADMIN all permissions (D9 — SUPER_ADMIN owns the full catalogue).
 *
 * IMPORTANT — role assignment security (D10):
 *  - SUPER_ADMIN is NOT assigned to any user here. It must be provisioned
 *    through a separately controlled bootstrap process.
 *  - AUTHENTICATED_USER is assigned through the standard Module 1 first-login sync.
 *  - No administrative users are created by this seed.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { configurationCatalogue, initialFeatureFlags } from "../src/platform/configuration-catalogue";
import {
  platformRoleCodes,
  baselineAdminPermissionCodes,
  allAdminPermissionCodes,
  examManagementPermissionCodes,
} from "../src/roles/baseline-permissions";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the identity catalogue");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

// ── Permission display names (D9) ────────────────────────────────────────────
// Maps every admin.* permission code to a human-readable name.
// This is the authoritative name list — it determines what the Admin UI displays.
const permissionNames: Record<string, string> = {
  // Dashboard (D11)
  "admin.dashboard.view": "View admin dashboard",

  // User management (D2, D8)
  "admin.users.view": "View users",
  "admin.users.search": "Search users",
  "admin.users.status.update": "Update user account status",
  "admin.users.lock": "Lock user accounts",
  "admin.users.reinstate": "Reinstate suspended accounts",
  "admin.users.unlock": "Unlock locked accounts",
  "admin.users.activity.view": "View user activity",

  // Sessions (D1 / ADM-018)
  "admin.sessions.view": "View own sessions",
  "admin.sessions.revoke": "Revoke own sessions",

  // Roles (D7, D9)
  "admin.roles.view": "View roles",
  "admin.roles.create": "Create roles",
  "admin.roles.update": "Update roles",
  "admin.roles.assign": "Assign roles to users",
  "admin.roles.revoke": "Revoke role assignments",
  "admin.permissions.view": "View permission definitions",
  "admin.roles.permissions.manage": "Manage role-permission mappings",

  // Audit (D7)
  "admin.audit.view": "View audit logs",

  // Platform settings (D4, D6)
  "admin.settings.view": "View platform settings",
  "admin.settings.update": "Update platform settings",

  // Feature flags (D5)
  "admin.feature_flags.view": "View feature flags",
  "admin.feature_flags.update": "Update feature flags",

  // Module 2 â€” taxonomy, permanent examination master and independent cycles.
  "exam.taxonomy.read": "View examination taxonomy",
  "exam.taxonomy.manage": "Manage examination categories and groups",
  "exam.authority.manage": "Manage examination authorities",
  "exam.catalogue.read": "View examination catalogue",
  "exam.catalogue.create": "Create examinations",
  "exam.catalogue.update": "Update examinations and aliases",
  "exam.catalogue.archive": "Archive examinations",
  "exam.cycle.read": "View examination cycles",
  "exam.cycle.manage": "Create, update and archive examination cycles",
  "exam.eligibility.read": "View examination eligibility configuration",
  "exam.eligibility.manage": "Manage examination eligibility configuration",
  "exam.events.manage": "Manage examination events",
  "exam.salary.manage": "Manage examination salary records",
  "exam.cutoff.manage": "Manage examination cutoff records",
  "exam.pattern.manage": "Manage examination patterns and selection processes",
  "exam.syllabus.manage": "Manage structured, versioned examination syllabuses",
  "exam.documents.manage": "Manage official examination documents and links",
  "exam.faq.manage": "Manage examination FAQs",
  "exam.import": "Import examination data",
  "exam.review": "Review examination content",
  "exam.verify": "Verify examination content",
  "exam.publish": "Publish examination content",
  "exam.unpublish": "Unpublish examination content",
};

// Derive module/resource/action from the permission code (admin.resource.action).
function parsePermissionCode(code: string) {
  const parts = code.split(".");
  // e.g. admin.roles.permissions.manage → module=admin, resource=roles.permissions, action=manage
  const module = parts[0];
  const action = parts[parts.length - 1];
  const resource = parts.slice(1, -1).join(".");
  return { module, resource, action };
}

// ── Email templates ──────────────────────────────────────────────────────────
const emailTemplates = [
  {
    templateKey: "WELCOME",
    subject: "Welcome to Examinity",
    bodyHtml: "<p>Welcome, {{display_name}}.</p>",
    bodyText: "Welcome, {{display_name}}.",
  },
  {
    templateKey: "ACCOUNT_ENABLED",
    subject: "Your Examinity account is enabled",
    bodyHtml: "<p>Hello {{display_name}}, your Examinity account has been enabled.</p>",
    bodyText: "Hello {{display_name}}, your Examinity account has been enabled.",
  },
  {
    templateKey: "ACCOUNT_DISABLED",
    subject: "Your Examinity account has been disabled",
    bodyHtml: "<p>Hello {{display_name}}, your Examinity account has been disabled.</p>",
    bodyText: "Hello {{display_name}}, your Examinity account has been disabled.",
  },
  {
    templateKey: "ACCOUNT_SUSPENDED",
    subject: "Your Examinity account has been suspended",
    bodyHtml: "<p>Hello {{display_name}}, your Examinity account has been suspended. Contact support if you believe this is in error.</p>",
    bodyText: "Hello {{display_name}}, your Examinity account has been suspended. Contact support if you believe this is in error.",
  },
  {
    templateKey: "ACCOUNT_REINSTATED",
    subject: "Your Examinity account has been reinstated",
    bodyHtml:
      "<p>Hello {{display_name}}, your Examinity account has been reinstated and is now active. If you did not request this, contact support immediately.</p>",
    bodyText:
      "Hello {{display_name}}, your Examinity account has been reinstated and is now active. If you did not request this, contact support immediately.",
  },
  {
    templateKey: "ACCOUNT_UNLOCKED",
    subject: "Your Examinity account has been unlocked",
    bodyHtml:
      "<p>Hello {{display_name}}, your Examinity account has been unlocked. If you did not request this, contact support immediately.</p>",
    bodyText: "Hello {{display_name}}, your Examinity account has been unlocked. If you did not request this, contact support immediately.",
  },
  {
    templateKey: "ROLE_ASSIGNED",
    subject: "An Examinity role was assigned",
    bodyHtml: "<p>Hello {{display_name}}, the {{role_name}} role was assigned to your account.</p>",
    bodyText: "Hello {{display_name}}, the {{role_name}} role was assigned to your account.",
  },
  {
    templateKey: "ROLE_REMOVED",
    subject: "An Examinity role was removed",
    bodyHtml: "<p>Hello {{display_name}}, the {{role_name}} role was removed from your account.</p>",
    bodyText: "Hello {{display_name}}, the {{role_name}} role was removed from your account.",
  },
  {
    templateKey: "SECURITY_NOTIFICATION",
    subject: "Examinity security notification",
    bodyHtml: "<p>Hello {{display_name}}, an administrative security change affected your account.</p>",
    bodyText: "Hello {{display_name}}, an administrative security change affected your account.",
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.info("Seeding platform configuration catalogue (D4)…");
  for (const [configKey, definition] of Object.entries(configurationCatalogue)) {
    await prisma.configuration.upsert({
      where: { configKey },
      // On update: only refresh catalogue metadata fields — never overwrite a
      // live administrator-managed value_json.
      update: {
        settingName: definition.settingName,
        category: definition.category,
        description: definition.description,
        valueType: definition.type,
        isSensitive: definition.isSensitive,
        isEditable: definition.isEditable,
      },
      create: {
        configKey,
        settingName: definition.settingName,
        category: definition.category,
        valueJson: definition.defaultValue as never,
        valueType: definition.type,
        description: definition.description,
        isSensitive: definition.isSensitive,
        isEditable: definition.isEditable,
        status: "ACTIVE",
      },
    });
  }

  console.info("Seeding feature flags (D5)…");
  for (const flag of initialFeatureFlags) {
    await prisma.featureFlag.upsert({
      where: { flagKey: flag.key },
      // Update name/description on re-seed; never overwrite a live enabled value.
      update: { name: flag.name, description: flag.description },
      create: {
        flagKey: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: false,
        status: "ACTIVE",
      },
    });
  }

  console.info("Seeding email templates…");
  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { templateKey: template.templateKey },
      update: { subject: template.subject, bodyHtml: template.bodyHtml, bodyText: template.bodyText },
      create: template,
    });
  }

  // ── Permissions (D9) ───────────────────────────────────────────────────────
  console.info("Seeding admin.* permission catalogue (D9)…");
  const permissions = new Map<string, string>(); // code → id
  for (const [code, name] of Object.entries(permissionNames)) {
    const { module, resource, action } = parsePermissionCode(code);
    const item = await prisma.permission.upsert({
      where: { code },
      update: { name, module, resource, action, systemPermission: true, active: true },
      create: { code, name, module, resource, action, systemPermission: true, active: true },
    });
    permissions.set(code, item.id);
  }

  // ── Roles (D10) ────────────────────────────────────────────────────────────
  // Deactivate unapproved future roles so they cannot be assigned via the Admin UI.
  console.info("Deactivating unapproved future roles (D10)…");
  for (const code of ["CONTENT_ADMIN", "REVIEWER", "PUBLISHER"]) {
    await prisma.role.updateMany({ where: { code }, data: { active: false, assignable: false } });
  }

  console.info("Seeding approved roles (D10)…");
  const roles = new Map<string, string>(); // code → id
  for (const code of platformRoleCodes) {
    const role = await prisma.role.upsert({
      where: { code },
      update: {
        systemRole: true,
        protectedRole: true,
        // Only ADMIN is publicly assignable through the Admin Module workflow.
        // SUPER_ADMIN requires a separate controlled bootstrap; AUTHENTICATED_USER
        // is assigned by the first-login sync.
        assignable: code === "ADMIN",
        active: true,
      },
      create: {
        code,
        name: code
          .split("_")
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(" "),
        systemRole: true,
        protectedRole: true,
        assignable: code === "ADMIN",
        active: true,
      },
    });
    roles.set(code, role.id);
  }

  // ── Role-permission grants (D9) ────────────────────────────────────────────
  // ADMIN receives the baseline set (no reinstate/unlock/write ops by default).
  // SUPER_ADMIN receives all permissions.
  // AUTHENTICATED_USER receives no administrative permissions.
  const grants: Record<string, readonly string[]> = {
    ADMIN: baselineAdminPermissionCodes,
    SUPER_ADMIN: [...allAdminPermissionCodes, ...examManagementPermissionCodes],
  };

  console.info("Seeding role-permission grants…");
  for (const [roleCode, permissionCodes] of Object.entries(grants)) {
    const roleId = roles.get(roleCode);
    if (!roleId) continue;
    for (const permissionCode of permissionCodes) {
      const permissionId = permissions.get(permissionCode);
      if (!permissionId) {
        console.warn(`  WARN: permission ${permissionCode} not found in catalogue — skipping grant for ${roleCode}`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  console.info(
    "Seed complete.\n" +
      "  • SUPER_ADMIN must be provisioned through a controlled bootstrap process — no admin users created here.\n" +
      "  • AUTHENTICATED_USER is assigned by the first-login sync in Module 1.\n" +
      "  • admin.users.reinstate and admin.users.unlock are withheld from ADMIN by default (D2, D8).",
  );
}

main().finally(() => prisma.$disconnect());
