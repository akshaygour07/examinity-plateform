CREATE SCHEMA IF NOT EXISTS "platform";
CREATE SCHEMA IF NOT EXISTS "audit";
CREATE SCHEMA IF NOT EXISTS "media";
CREATE SCHEMA IF NOT EXISTS "notification";

CREATE TABLE "platform"."configurations" (
    "id" UUID NOT NULL,
    "config_key" VARCHAR(200) NOT NULL,
    "value_json" JSONB NOT NULL,
    "value_type" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    CONSTRAINT "configurations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "configurations_version_check" CHECK ("version" > 0),
    CONSTRAINT "configurations_value_type_check" CHECK ("value_type" IN ('STRING', 'NUMBER', 'BOOLEAN', 'OBJECT', 'ARRAY'))
);
CREATE UNIQUE INDEX "configurations_config_key_key" ON "platform"."configurations"("config_key");
CREATE INDEX "configurations_updated_by_idx" ON "platform"."configurations"("updated_by");
ALTER TABLE "platform"."configurations" ADD CONSTRAINT "configurations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "platform"."feature_flags" (
    "id" UUID NOT NULL,
    "flag_key" VARCHAR(150) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feature_flags_flag_key_key" ON "platform"."feature_flags"("flag_key");
CREATE INDEX "feature_flags_updated_by_idx" ON "platform"."feature_flags"("updated_by");
ALTER TABLE "platform"."feature_flags" ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "platform"."idempotency_keys" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(150) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "response_status" INTEGER,
    "response_json" JSONB,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_keys_response_status_check" CHECK ("response_status" IS NULL OR "response_status" BETWEEN 100 AND 599)
);
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "platform"."idempotency_keys"("scope", "idempotency_key");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "platform"."idempotency_keys"("expires_at");

CREATE TABLE "audit"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" UUID,
    "request_id" VARCHAR(100) NOT NULL,
    "correlation_id" VARCHAR(100),
    "result" VARCHAR(30) NOT NULL,
    "metadata_json" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_result_check" CHECK ("result" IN ('SUCCESS', 'FAILURE'))
);
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit"."audit_logs"("actor_user_id");
CREATE INDEX "audit_logs_resource_idx" ON "audit"."audit_logs"("resource_type", "resource_id");
CREATE INDEX "audit_logs_request_id_idx" ON "audit"."audit_logs"("request_id");
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit"."audit_logs"("occurred_at");
ALTER TABLE "audit"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "audit"."reject_audit_mutation"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'audit records are append-only'; END; $$;
CREATE TRIGGER "audit_logs_append_only"
    BEFORE UPDATE OR DELETE ON "audit"."audit_logs"
    FOR EACH ROW EXECUTE FUNCTION "audit"."reject_audit_mutation"();

CREATE TABLE "media"."media_assets" (
    "id" UUID NOT NULL,
    "object_key" VARCHAR(500) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "checksum" VARCHAR(128),
    "storage_provider" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "visibility" VARCHAR(30) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_assets_file_size_check" CHECK ("file_size_bytes" >= 0),
    CONSTRAINT "media_assets_status_check" CHECK ("status" IN ('PENDING', 'AVAILABLE', 'QUARANTINED', 'REJECTED', 'DELETED')),
    CONSTRAINT "media_assets_visibility_check" CHECK ("visibility" IN ('PRIVATE', 'PUBLIC'))
);
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media"."media_assets"("object_key");
CREATE INDEX "media_assets_uploaded_by_idx" ON "media"."media_assets"("uploaded_by");
CREATE INDEX "media_assets_status_idx" ON "media"."media_assets"("status");
ALTER TABLE "media"."media_assets" ADD CONSTRAINT "media_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identity"."user_profiles" ADD CONSTRAINT "user_profiles_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media"."media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "notification"."email_templates" (
    "id" UUID NOT NULL,
    "template_key" VARCHAR(150) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-IN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_templates_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "email_templates_template_key_key" ON "notification"."email_templates"("template_key");

CREATE TABLE "notification"."email_preferences" (
    "user_id" UUID NOT NULL,
    "transactional_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "marketing_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "email_preferences_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "notification"."email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "role_permissions_permission_id_idx" ON "identity"."role_permissions"("permission_id");
