-- Phone-passwordless users may not have an email. Terms acceptance is recorded
-- for new account provisioning without storing any OTP or authentication secret.
ALTER TABLE "identity"."users"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "email_normalized" DROP NOT NULL,
  ADD COLUMN "terms_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "terms_version" VARCHAR(50);

ALTER TABLE "identity"."users"
  ADD CONSTRAINT "users_terms_acceptance_pair_check"
  CHECK (("terms_accepted_at" IS NULL) = ("terms_version" IS NULL));
