import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { EMAIL_PROVIDER, type EmailProvider } from "./email-provider";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

@Injectable()
/** Renders stored transactional templates and delegates delivery without logging recipient content. */
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  /** Sends a template to a user's current email address; delivery is best-effort after business changes commit. */
  async sendToUser(userId: string, templateKey: string, variables: Record<string, string>): Promise<boolean> {
    try {
      const [user, template] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, include: { emailPreference: true } }),
        this.prisma.emailTemplate.findUnique({ where: { templateKey } }),
      ]);
      const essential = ["ACCOUNT_ENABLED", "ACCOUNT_DISABLED", "ROLE_ASSIGNED", "ROLE_REMOVED", "SECURITY_NOTIFICATION"].includes(
        templateKey,
      );
      if (!user?.email || !template?.active || (!essential && user.emailPreference?.transactionalEnabled === false)) return false;
      const htmlValues = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, escapeHtml(value)]));
      const textValues = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, value.replace(/[\r\n\0]/g, " ")]));
      const interpolate = (source: string, values: Record<string, string>) =>
        source.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? "");
      await this.provider.sendTransactionalEmail({
        from: process.env.EMAIL_FROM ?? "",
        to: user.email,
        subject: interpolate(template.subject, textValues),
        html: interpolate(template.bodyHtml, htmlValues),
        text: template.bodyText ? interpolate(template.bodyText, textValues) : undefined,
        replyTo: process.env.EMAIL_REPLY_TO,
      });
      return true;
    } catch {
      // Delivery is best-effort after a committed business operation. Never log recipient, body, or provider response.
      this.logger.warn(`Transactional notification '${templateKey}' could not be delivered.`);
      return false;
    }
  }
}
