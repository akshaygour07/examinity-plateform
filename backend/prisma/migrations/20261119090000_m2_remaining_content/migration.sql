CREATE TABLE "exam"."exam_documents" (
  "id" UUID NOT NULL, "exam_id" UUID NOT NULL, "exam_cycle_id" UUID, "document_title" VARCHAR(250) NOT NULL, "document_type" VARCHAR(50) NOT NULL, "media_id" UUID, "external_url" TEXT, "source_reference_id" UUID, "verification_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT', "display_order" INTEGER NOT NULL DEFAULT 0, "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "exam_documents_pkey" PRIMARY KEY ("id"));
CREATE INDEX "exam_documents_exam_id_idx" ON "exam"."exam_documents"("exam_id");
CREATE TABLE "exam"."exam_links" (
  "id" UUID NOT NULL, "exam_id" UUID NOT NULL, "exam_cycle_id" UUID, "title" VARCHAR(200) NOT NULL, "url" TEXT NOT NULL, "link_type" VARCHAR(50) NOT NULL, "source_reference_id" UUID, "display_order" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "exam_links_pkey" PRIMARY KEY ("id"));
CREATE INDEX "exam_links_exam_id_idx" ON "exam"."exam_links"("exam_id");
CREATE TABLE "exam"."exam_faqs" (
  "id" UUID NOT NULL, "exam_id" UUID NOT NULL, "exam_cycle_id" UUID, "question" TEXT NOT NULL, "answer" TEXT NOT NULL, "language_code" VARCHAR(10) NOT NULL DEFAULT 'en', "display_order" INTEGER NOT NULL DEFAULT 0, "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT', "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "exam_faqs_pkey" PRIMARY KEY ("id"));
CREATE INDEX "exam_faqs_exam_id_idx" ON "exam"."exam_faqs"("exam_id");
CREATE TABLE "exam"."exam_import_jobs" (
  "id" UUID NOT NULL, "import_type" VARCHAR(50) NOT NULL, "file_media_id" UUID NOT NULL, "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING', "total_rows" INTEGER NOT NULL DEFAULT 0, "valid_rows" INTEGER NOT NULL DEFAULT 0, "invalid_rows" INTEGER NOT NULL DEFAULT 0, "created_by" UUID, "started_at" TIMESTAMPTZ(6), "completed_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "exam_import_jobs_pkey" PRIMARY KEY ("id"));
CREATE TABLE "exam"."exam_import_rows" (
  "id" UUID NOT NULL, "import_job_id" UUID NOT NULL, "row_number" INTEGER NOT NULL, "source_data" JSONB NOT NULL, "validation_errors" JSONB, "import_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING', "created_record_id" UUID, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "exam_import_rows_pkey" PRIMARY KEY ("id"));
CREATE INDEX "exam_import_rows_import_job_id_idx" ON "exam"."exam_import_rows"("import_job_id");
ALTER TABLE "exam"."exam_import_rows" ADD CONSTRAINT "exam_import_rows_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "exam"."exam_import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
