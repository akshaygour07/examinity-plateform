import assert from "node:assert/strict";
import { EmailService } from "./email.service";

test("renders escaped HTML and sanitized text using stored templates", async () => {
  let message: Record<string, unknown> | undefined;
  const service = new EmailService(
    {
      user: { findUnique: async () => ({ email: "a@example.test", emailPreference: null }) },
      emailTemplate: {
        findUnique: async () => ({ active: true, subject: "Hi {{name}}", bodyHtml: "<b>{{name}}</b>", bodyText: "{{name}}" }),
      },
    } as never,
    {
      sendTransactionalEmail: async (input: Record<string, unknown>) => {
        message = input;
      },
    } as never,
  );
  assert.equal(await service.sendToUser("u", "WELCOME", { name: "<Ada>\n" }), true);
  assert.equal(message?.subject, "Hi <Ada> ");
  assert.equal(message?.html, "<b>&lt;Ada&gt;\n</b>");
});

test("skips opted-out nonessential messages and treats provider failures as best-effort", async () => {
  const prisma = {
    user: { findUnique: async () => ({ email: "a@example.test", emailPreference: { transactionalEnabled: false } }) },
    emailTemplate: { findUnique: async () => ({ active: true, subject: "", bodyHtml: "" }) },
  };
  const service = new EmailService(
    prisma as never,
    {
      sendTransactionalEmail: async () => {
        throw new Error("offline");
      },
    } as never,
  );
  assert.equal(await service.sendToUser("u", "WELCOME", {}), false);
  assert.equal(await service.sendToUser("u", "ACCOUNT_DISABLED", {}), false);
});
