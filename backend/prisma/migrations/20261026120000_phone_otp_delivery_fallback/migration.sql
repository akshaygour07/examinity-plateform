CREATE TABLE "identity"."phone_otp_delivery_attempts" (
    "id" UUID NOT NULL,
    "recipient_hash" VARCHAR(64) NOT NULL,
    "encrypted_payload" VARCHAR(1000),
    "encryption_iv" VARCHAR(32),
    "encryption_tag" VARCHAR(32),
    "whatsapp_message_sid" VARCHAR(40),
    "status" VARCHAR(30) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "phone_otp_delivery_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "phone_otp_delivery_attempts_status_check"
      CHECK ("status" IN ('PENDING', 'DELIVERED', 'FALLBACK_SENDING', 'SMS_SENT', 'FAILED', 'EXPIRED')),
    CONSTRAINT "phone_otp_delivery_attempts_encryption_pair_check"
      CHECK (("encrypted_payload" IS NULL AND "encryption_iv" IS NULL AND "encryption_tag" IS NULL)
          OR ("encrypted_payload" IS NOT NULL AND "encryption_iv" IS NOT NULL AND "encryption_tag" IS NOT NULL))
);

CREATE UNIQUE INDEX "phone_otp_delivery_attempts_whatsapp_sid_key"
  ON "identity"."phone_otp_delivery_attempts"("whatsapp_message_sid");
CREATE INDEX "phone_otp_delivery_attempts_expires_at_idx"
  ON "identity"."phone_otp_delivery_attempts"("expires_at");
CREATE INDEX "phone_otp_delivery_attempts_recipient_created_idx"
  ON "identity"."phone_otp_delivery_attempts"("recipient_hash", "created_at");
