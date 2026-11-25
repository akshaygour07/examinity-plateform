/**
 * Auth0 Branding > Phone Provider > Custom > Custom Phone Provider Action.
 * Add secrets PHONE_DELIVERY_URL (public HTTPS /api/v1/auth/phone/deliver)
 * and PHONE_PROVIDER_API_SECRET (same value as Nest's environment).
 * Auth0 owns OTP creation, expiry, attempt validation and token issuance.
 */
exports.onExecuteCustomPhoneProvider = async (event, api) => {
  const notification = event.notification || {};
  if (!["otp_enroll", "otp_verify"].includes(notification.message_type)) return;
  if (!event.secrets.PHONE_DELIVERY_URL || !event.secrets.PHONE_PROVIDER_API_SECRET) {
    throw new Error("Phone verification delivery is not configured");
  }

  const response = await fetch(event.secrets.PHONE_DELIVERY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${event.secrets.PHONE_PROVIDER_API_SECRET}`,
    },
    body: JSON.stringify({
      recipient: notification.recipient,
      code: notification.code,
      message_type: notification.message_type,
      locale: notification.locale || "en",
    }),
    // Nest tries WhatsApp first and sends the same OTP by SMS on an immediate rejection.
    // If Twilio reports an asynchronous delivery failure, its signed callback triggers SMS fallback.
    signal: AbortSignal.timeout(18000),
  });

  if (!response.ok) {
    // Fail closed: Auth0 must not proceed as if it delivered an OTP when neither channel succeeded.
    throw new Error("Phone verification delivery failed");
  }
  const delivery = await response.json();
  // Helpful for a non-production delivery demo. Do not log the recipient or OTP.
  console.log(`Examinity OTP delivery channel: ${delivery.data?.channel || "accepted"}`);
};
