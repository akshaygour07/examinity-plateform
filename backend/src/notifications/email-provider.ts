export type TransactionalEmail = { from: string; to: string; subject: string; html: string; text?: string; replyTo?: string };

export interface EmailProvider {
  sendTransactionalEmail(message: TransactionalEmail): Promise<void>;
}
export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
