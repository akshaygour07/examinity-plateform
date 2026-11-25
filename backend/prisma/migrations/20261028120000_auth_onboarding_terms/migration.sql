ALTER TABLE "identity"."users"
  ADD COLUMN "phone_verified" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE "identity"."terms_acceptances" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "terms_version" VARCHAR(50) NOT NULL,
  "accepted" BOOLEAN NOT NULL,
  "accepted_at" TIMESTAMPTZ(6) NOT NULL,
  "registration_source" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "terms_acceptances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "terms_acceptances_accepted_check" CHECK ("accepted" = TRUE),
  CONSTRAINT "terms_acceptances_source_check" CHECK ("registration_source" IN ('EMAIL', 'PHONE', 'SOCIAL', 'UNKNOWN'))
);

CREATE UNIQUE INDEX "terms_acceptances_user_version_key"
  ON "identity"."terms_acceptances"("user_id", "terms_version");
CREATE INDEX "terms_acceptances_user_accepted_idx"
  ON "identity"."terms_acceptances"("user_id", "accepted_at");
ALTER TABLE "identity"."terms_acceptances"
  ADD CONSTRAINT "terms_acceptances_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "identity"."reject_terms_acceptance_mutation"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'terms acceptance records are append-only'; END; $$;
CREATE TRIGGER "terms_acceptances_append_only"
    BEFORE UPDATE OR DELETE ON "identity"."terms_acceptances"
    FOR EACH ROW EXECUTE FUNCTION "identity"."reject_terms_acceptance_mutation"();
