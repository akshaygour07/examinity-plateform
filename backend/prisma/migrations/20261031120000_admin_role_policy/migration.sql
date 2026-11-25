ALTER TABLE "identity"."roles"
    ADD COLUMN "is_protected" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN "assignable" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "identity"."roles"
SET "is_protected" = TRUE,
    "assignable" = ("code" = 'ADMIN')
WHERE "code" IN ('SUPER_ADMIN', 'ADMIN', 'AUTHENTICATED_USER');

UPDATE "identity"."roles"
SET "active" = FALSE,
    "assignable" = FALSE
WHERE "code" IN ('CONTENT_ADMIN', 'REVIEWER', 'PUBLISHER');

ALTER TABLE "identity"."user_profiles"
    ADD COLUMN "language" VARCHAR(10) NOT NULL DEFAULT 'en';

ALTER TABLE "identity"."user_role_assignments"
    ADD COLUMN "revoked_at" TIMESTAMPTZ(6);

UPDATE "identity"."user_role_assignments"
SET "revoked_at" = CURRENT_TIMESTAMP
WHERE "status" = 'REVOKED' AND "revoked_at" IS NULL;

