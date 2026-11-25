-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL,
    "auth0_subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "email_normalized" VARCHAR(320) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "phone_e164" VARCHAR(20),
    "status" VARCHAR(30) NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "identity"."users"
    ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
    ADD CONSTRAINT "users_version_check" CHECK ("version" > 0);

-- CreateTable
CREATE TABLE "identity"."user_profiles" (
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(150),
    "avatar_media_id" UUID,
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "preferences_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "identity"."roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "system_role" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(150) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "identity"."user_role_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "identity"."user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
    ADD CONSTRAINT "user_role_assignments_dates_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" > "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_subject_key" ON "identity"."users"("auth0_subject");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "identity"."users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "identity"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "identity"."permissions"("code");

-- CreateIndex
CREATE INDEX "user_role_assignments_role_id_idx" ON "identity"."user_role_assignments"("role_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_idx" ON "identity"."user_role_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_role_key" ON "identity"."user_role_assignments"("user_id", "role_id");

-- AddForeignKey
ALTER TABLE "identity"."users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."users" ADD CONSTRAINT "users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "identity"."permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

