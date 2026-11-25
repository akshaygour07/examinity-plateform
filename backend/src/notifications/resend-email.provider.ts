import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { EmailProvider, TransactionalEmail } from "./email-provider";

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);
  async sendTransactionalEmail(message: TransactionalEmail): Promise<void> {
    if (process.env.EMAIL_PROVIDER !== "resend" || !process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM) {
      throw new ServiceUnavailableException("Transactional email is not configured.");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${process.env.EMAIL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      this.logger.warn("Transactional email provider rejected a message");
      throw new ServiceUnavailableException("Transactional email could not be delivered.");
    }
  }
}
