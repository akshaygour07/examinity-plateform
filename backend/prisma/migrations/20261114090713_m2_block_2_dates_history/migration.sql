-- CreateTable
CREATE TABLE "exam"."exam_events" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMPTZ(6),
    "end_at" TIMESTAMPTZ(6),
    "display_timezone" VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
    "event_status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "source_reference_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exam_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."exam_event_revisions" (
    "id" UUID NOT NULL,
    "exam_event_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "previous_start_at" TIMESTAMPTZ(6),
    "new_start_at" TIMESTAMPTZ(6),
    "previous_end_at" TIMESTAMPTZ(6),
    "new_end_at" TIMESTAMPTZ(6),
    "revision_reason" TEXT NOT NULL,
    "source_reference_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_event_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."selection_process_versions" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selection_process_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."selection_stages" (
    "id" UUID NOT NULL,
    "selection_process_version_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "stage_type" VARCHAR(50) NOT NULL,

    CONSTRAINT "selection_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."salary_records" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "post_name" VARCHAR(200) NOT NULL,
    "pay_level" VARCHAR(50),
    "basic_pay_min" DECIMAL(12,2),
    "basic_pay_max" DECIMAL(12,2),
    "pay_scale" TEXT,
    "allowances" JSONB,
    "benefits" TEXT,
    "effective_from" DATE,
    "effective_to" DATE,
    "source_reference_id" UUID,

    CONSTRAINT "salary_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."exam_analysis_records" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "analysis_year" SMALLINT NOT NULL,
    "analysis_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL,
    "source_reference_id" UUID,
    "verification_status" VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED',
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "exam_analysis_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."cutoff_records" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "cutoff_year" SMALLINT NOT NULL,
    "stage_type" VARCHAR(50) NOT NULL,
    "category_code" VARCHAR(50) NOT NULL,
    "cutoff_marks" DECIMAL(10,2) NOT NULL,
    "maximum_marks" DECIMAL(10,2),
    "cutoff_type" VARCHAR(30) NOT NULL,
    "source_reference_id" UUID,
    "verification_status" VARCHAR(30) NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "cutoff_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_events_exam_cycle_id_start_at_idx" ON "exam"."exam_events"("exam_cycle_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "exam_event_revisions_exam_event_id_revision_number_key" ON "exam"."exam_event_revisions"("exam_event_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "selection_process_versions_exam_cycle_id_version_number_key" ON "exam"."selection_process_versions"("exam_cycle_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "selection_stages_selection_process_version_id_sequence_key" ON "exam"."selection_stages"("selection_process_version_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "cutoff_records_exam_cycle_id_cutoff_year_stage_type_categor_key" ON "exam"."cutoff_records"("exam_cycle_id", "cutoff_year", "stage_type", "category_code", "cutoff_type");

-- AddForeignKey
ALTER TABLE "exam"."exam_events" ADD CONSTRAINT "exam_events_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_event_revisions" ADD CONSTRAINT "exam_event_revisions_exam_event_id_fkey" FOREIGN KEY ("exam_event_id") REFERENCES "exam"."exam_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."selection_process_versions" ADD CONSTRAINT "selection_process_versions_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."selection_stages" ADD CONSTRAINT "selection_stages_selection_process_version_id_fkey" FOREIGN KEY ("selection_process_version_id") REFERENCES "exam"."selection_process_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."salary_records" ADD CONSTRAINT "salary_records_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_analysis_records" ADD CONSTRAINT "exam_analysis_records_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."cutoff_records" ADD CONSTRAINT "cutoff_records_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
