import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PhoneOtpDeliveryDto } from "./phone-otp-delivery.dto";

type TwilioMessageResponse = { sid?: string; status?: string; code?: number; message?: string };

@Injectable()
export class PhoneOtpDeliveryService {
  private readonly fallbackLog = new Map<string, { count: number; resetsAt: number }>();

  private config() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
    const smsFrom = process.env.TWILIO_SMS_FROM;
    const whatsappContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
    if (!accountSid || !authToken || !whatsappFrom || !smsFrom || !whatsappContentSid)
      throw new ServiceUnavailableException({
        code: "phone_delivery_unavailable",
        message: "Phone verification delivery is not configured.",
      });
    if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid) || !/^HX[a-fA-F0-9]{32}$/.test(whatsappContentSid))
      throw new ServiceUnavailableException({
        code: "phone_delivery_unavailable",
        message: "Phone verification delivery is not configured correctly.",
      });
    return { accountSid, authToken, whatsappFrom, smsFrom, whatsappContentSid };
  }

  private async send(fields: Record<string, string>) {
    const { accountSid, authToken } = this.config();
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    let response: Response;
    try {
      response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${credentials}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new Error("Phone provider request failed");
    }
    const result = (await response.json().catch(() => ({}))) as TwilioMessageResponse;
    if (!response.ok) throw new Error(`Phone provider rejected delivery (${result.code ?? response.status})`);
    return result;
  }

  private enforceFallbackRate(recipient: string) {
    const now = Date.now();
    const key = createHash("sha256").update(recipient).digest("hex");
    const entry = this.fallbackLog.get(key);
    if (entry && entry.resetsAt > now && entry.count >= 5)
      throw new ServiceUnavailableException({
        code: "phone_delivery_rate_limited",
        message: "Too many phone verification attempts. Try again later.",
      });
    if (!entry || entry.resetsAt <= now) this.fallbackLog.set(key, { count: 1, resetsAt: now + 10 * 60_000 });
    else entry.count++;
    if (this.fallbackLog.size > 10_000) {
      for (const [phoneHash, window] of this.fallbackLog) if (window.resetsAt <= now) this.fallbackLog.delete(phoneHash);
    }
  }

  async deliver(input: PhoneOtpDeliveryDto) {
    this.enforceFallbackRate(input.recipient);
    const { whatsappFrom, smsFrom, whatsappContentSid } = this.config();
    try {
      const response = await this.send({
        To: `whatsapp:${input.recipient}`,
        From: whatsappFrom.startsWith("whatsapp:") ? whatsappFrom : `whatsapp:${whatsappFrom}`,
        ContentSid: whatsappContentSid,
        ContentVariables: JSON.stringify({ "1": input.code }),
      });
      return { data: { channel: "whatsapp", provider_reference: response.sid ?? null } };
    } catch {
      // Auth0 owns the code and its verification/expiry. SMS fallback sends the same code.
      try {
        const response = await this.send({
          To: input.recipient,
          From: smsFrom,
          Body: `Your Examinity verification code is ${input.code}. Do not share this code.`,
        });
        return { data: { channel: "sms", provider_reference: response.sid ?? null } };
      } catch {
        throw new ServiceUnavailableException({
          code: "phone_delivery_failed",
          message: "We could not deliver the verification code. Try again later.",
        });
      }
    }
  }
}
