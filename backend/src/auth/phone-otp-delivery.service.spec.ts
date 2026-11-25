import assert from "node:assert/strict";
import { PhoneOtpDeliveryService } from "./phone-otp-delivery.service";

const envKeys = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "TWILIO_SMS_FROM",
  "TWILIO_WHATSAPP_CONTENT_SID",
] as const;
function configure() {
  process.env.TWILIO_ACCOUNT_SID = `AC${"a".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "token";
  process.env.TWILIO_WHATSAPP_FROM = "+10000000000";
  process.env.TWILIO_SMS_FROM = "+10000000001";
  process.env.TWILIO_WHATSAPP_CONTENT_SID = `HX${"b".repeat(32)}`;
}

test("fails closed when provider configuration is absent", async () => {
  const old = envKeys.map((key) => process.env[key]);
  try {
    envKeys.forEach((key) => delete process.env[key]);
    await assert.rejects(
      new PhoneOtpDeliveryService().deliver({ recipient: "+919876543210", code: "123456", locale: "en", message_type: "otp_verify" }),
    );
  } finally {
    envKeys.forEach((key, index) => (old[index] === undefined ? delete process.env[key] : (process.env[key] = old[index]!)));
  }
});

test("sends WhatsApp first and falls back to SMS after provider rejection", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  const calls: RequestInit[] = [];
  globalThis.fetch = async (_input, init) => {
    calls.push(init ?? {});
    return new Response(JSON.stringify(calls.length === 1 ? { code: 63016 } : { sid: "SM1" }), { status: calls.length === 1 ? 400 : 200 });
  };
  try {
    const result = await new PhoneOtpDeliveryService().deliver({
      recipient: "+919876543210",
      code: "123456",
      locale: "en",
      message_type: "otp_verify",
    });
    assert.equal(result.data.channel, "sms");
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
