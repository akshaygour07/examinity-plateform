-- DropForeignKey
ALTER TABLE "exam"."exam_aliases" DROP CONSTRAINT "exam_aliases_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_category_mappings" DROP CONSTRAINT "exam_category_mappings_category_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_category_mappings" DROP CONSTRAINT "exam_category_mappings_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_cycles" DROP CONSTRAINT "exam_cycles_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_group_mappings" DROP CONSTRAINT "exam_group_mappings_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_group_mappings" DROP CONSTRAINT "exam_group_mappings_group_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_groups" DROP CONSTRAINT "exam_groups_category_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_state_mappings" DROP CONSTRAINT "exam_state_mappings_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exam_state_mappings" DROP CONSTRAINT "exam_state_mappings_state_id_fkey";

-- DropForeignKey
ALTER TABLE "exam"."exams" DROP CONSTRAINT "exams_exam_body_id_fkey";

-- AlterTable
ALTER TABLE "exam"."exam_aliases" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_bodies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_category_mappings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_cycles" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_group_mappings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_groups" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exam_state_mappings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."exams" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam"."states" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity"."api_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "identity"."permissions" ALTER COLUMN "resource" DROP DEFAULT,
ALTER COLUMN "action" DROP DEFAULT;

-- CreateTable
CREATE TABLE "exam"."exam_overview_versions" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "description" TEXT,
    "qualification_summary" TEXT,
    "age_summary" TEXT,
    "vacancy_summary" TEXT,
    "mode_summary" TEXT,
    "notification_summary" TEXT,
    "source_reference_id" UUID,
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "exam_overview_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."eligibility_profiles" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "eligibility_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."eligibility_versions" (
    "id" UUID NOT NULL,
    "eligibility_profile_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "reference_date" DATE,
    "nationality_required" BOOLEAN NOT NULL DEFAULT false,
    "qualification_required" BOOLEAN NOT NULL DEFAULT false,
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "source_reference_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "eligibility_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."eligibility_inputs" (
    "id" UUID NOT NULL,
    "eligibility_version_id" UUID NOT NULL,
    "input_key" VARCHAR(100) NOT NULL,
    "label_en" VARCHAR(200) NOT NULL,
    "label_hi" VARCHAR(200),
    "input_type" VARCHAR(30) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "validation_config" JSONB,

    CONSTRAINT "eligibility_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."eligibility_rule_groups" (
    "id" UUID NOT NULL,
    "eligibility_version_id" UUID NOT NULL,
    "parent_group_id" UUID,
    "combination_operator" VARCHAR(10) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "eligibility_rule_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."eligibility_rules" (
    "id" UUID NOT NULL,
    "eligibility_rule_group_id" UUID NOT NULL,
    "rule_type" VARCHAR(50) NOT NULL,
    "input_key" VARCHAR(100),
    "operator" VARCHAR(30) NOT NULL,
    "comparison_value" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "failure_message_en" TEXT NOT NULL,
    "failure_message_hi" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "eligibility_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."exam_pattern_versions" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "source_reference_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "exam_pattern_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."exam_stages" (
    "id" UUID NOT NULL,
    "pattern_version_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "stage_code" VARCHAR(80),
    "stage_type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "is_qualifying" BOOLEAN NOT NULL DEFAULT false,
    "maximum_marks" DECIMAL(10,2),
    "duration_minutes" INTEGER,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."exam_papers" (
    "id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "paper_code" VARCHAR(80),
    "subject_name" VARCHAR(200),
    "total_questions" INTEGER,
    "maximum_marks" DECIMAL(10,2),
    "duration_minutes" INTEGER,
    "question_format" VARCHAR(40),
    "negative_marking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "negative_marking_value" DECIMAL(8,3),
    "is_qualifying" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "exam_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."exam_marking_schemes" (
    "id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "correct_marks" DECIMAL(8,3),
    "incorrect_marks" DECIMAL(8,3),
    "unanswered_marks" DECIMAL(8,3) DEFAULT 0,
    "calculation_type" VARCHAR(30) NOT NULL,
    "configuration" JSONB,

    CONSTRAINT "exam_marking_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabuses" (
    "id" UUID NOT NULL,
    "exam_cycle_id" UUID NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "syllabuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabus_versions" (
    "id" UUID NOT NULL,
    "syllabus_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_label" VARCHAR(100) NOT NULL,
    "language_default" VARCHAR(10) NOT NULL DEFAULT 'en',
    "source_reference_id" UUID,
    "official_document_id" UUID,
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "syllabus_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabus_stages" (
    "id" UUID NOT NULL,
    "syllabus_version_id" UUID NOT NULL,
    "exam_stage_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "syllabus_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabus_papers" (
    "id" UUID NOT NULL,
    "syllabus_stage_id" UUID NOT NULL,
    "exam_paper_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "syllabus_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabus_subjects" (
    "id" UUID NOT NULL,
    "syllabus_paper_id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "syllabus_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabus_topics" (
    "id" UUID NOT NULL,
    "syllabus_subject_id" UUID NOT NULL,
    "parent_topic_id" UUID,
    "topic_code" VARCHAR(100),
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "depth_level" SMALLINT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "syllabus_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam"."syllabus_topic_translations" (
    "id" UUID NOT NULL,
    "syllabus_topic_id" UUID NOT NULL,
    "language_code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "description" TEXT,

    CONSTRAINT "syllabus_topic_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_overview_versions_exam_cycle_id_version_number_key" ON "exam"."exam_overview_versions"("exam_cycle_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_profiles_exam_cycle_id_key" ON "exam"."eligibility_profiles"("exam_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_versions_eligibility_profile_id_version_number_key" ON "exam"."eligibility_versions"("eligibility_profile_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_inputs_eligibility_version_id_input_key_key" ON "exam"."eligibility_inputs"("eligibility_version_id", "input_key");

-- CreateIndex
CREATE UNIQUE INDEX "exam_pattern_versions_exam_cycle_id_version_number_key" ON "exam"."exam_pattern_versions"("exam_cycle_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "exam_stages_pattern_version_id_sequence_key" ON "exam"."exam_stages"("pattern_version_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "exam_papers_stage_id_sequence_key" ON "exam"."exam_papers"("stage_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "exam_marking_schemes_paper_id_key" ON "exam"."exam_marking_schemes"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "syllabuses_exam_cycle_id_key" ON "exam"."syllabuses"("exam_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_versions_syllabus_id_version_number_key" ON "exam"."syllabus_versions"("syllabus_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_topic_translations_syllabus_topic_id_language_code_key" ON "exam"."syllabus_topic_translations"("syllabus_topic_id", "language_code");

-- CreateIndex
CREATE INDEX "audit_logs_actor_occurred_at_idx" ON "audit"."audit_logs"("actor_user_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "exam"."exam_groups" ADD CONSTRAINT "exam_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "exam"."exam_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exams" ADD CONSTRAINT "exams_exam_body_id_fkey" FOREIGN KEY ("exam_body_id") REFERENCES "exam"."exam_bodies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_category_mappings" ADD CONSTRAINT "exam_category_mappings_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exam"."exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_category_mappings" ADD CONSTRAINT "exam_category_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "exam"."exam_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_group_mappings" ADD CONSTRAINT "exam_group_mappings_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exam"."exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_group_mappings" ADD CONSTRAINT "exam_group_mappings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "exam"."exam_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_state_mappings" ADD CONSTRAINT "exam_state_mappings_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exam"."exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_state_mappings" ADD CONSTRAINT "exam_state_mappings_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "exam"."states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_aliases" ADD CONSTRAINT "exam_aliases_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exam"."exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_cycles" ADD CONSTRAINT "exam_cycles_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exam"."exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_overview_versions" ADD CONSTRAINT "exam_overview_versions_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."eligibility_profiles" ADD CONSTRAINT "eligibility_profiles_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."eligibility_versions" ADD CONSTRAINT "eligibility_versions_eligibility_profile_id_fkey" FOREIGN KEY ("eligibility_profile_id") REFERENCES "exam"."eligibility_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."eligibility_inputs" ADD CONSTRAINT "eligibility_inputs_eligibility_version_id_fkey" FOREIGN KEY ("eligibility_version_id") REFERENCES "exam"."eligibility_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."eligibility_rule_groups" ADD CONSTRAINT "eligibility_rule_groups_eligibility_version_id_fkey" FOREIGN KEY ("eligibility_version_id") REFERENCES "exam"."eligibility_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."eligibility_rule_groups" ADD CONSTRAINT "eligibility_rule_groups_parent_group_id_fkey" FOREIGN KEY ("parent_group_id") REFERENCES "exam"."eligibility_rule_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."eligibility_rules" ADD CONSTRAINT "eligibility_rules_eligibility_rule_group_id_fkey" FOREIGN KEY ("eligibility_rule_group_id") REFERENCES "exam"."eligibility_rule_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_pattern_versions" ADD CONSTRAINT "exam_pattern_versions_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_stages" ADD CONSTRAINT "exam_stages_pattern_version_id_fkey" FOREIGN KEY ("pattern_version_id") REFERENCES "exam"."exam_pattern_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_papers" ADD CONSTRAINT "exam_papers_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "exam"."exam_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."exam_marking_schemes" ADD CONSTRAINT "exam_marking_schemes_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "exam"."exam_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabuses" ADD CONSTRAINT "syllabuses_exam_cycle_id_fkey" FOREIGN KEY ("exam_cycle_id") REFERENCES "exam"."exam_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_versions" ADD CONSTRAINT "syllabus_versions_syllabus_id_fkey" FOREIGN KEY ("syllabus_id") REFERENCES "exam"."syllabuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_stages" ADD CONSTRAINT "syllabus_stages_syllabus_version_id_fkey" FOREIGN KEY ("syllabus_version_id") REFERENCES "exam"."syllabus_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_papers" ADD CONSTRAINT "syllabus_papers_syllabus_stage_id_fkey" FOREIGN KEY ("syllabus_stage_id") REFERENCES "exam"."syllabus_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_subjects" ADD CONSTRAINT "syllabus_subjects_syllabus_paper_id_fkey" FOREIGN KEY ("syllabus_paper_id") REFERENCES "exam"."syllabus_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_topics" ADD CONSTRAINT "syllabus_topics_syllabus_subject_id_fkey" FOREIGN KEY ("syllabus_subject_id") REFERENCES "exam"."syllabus_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_topics" ADD CONSTRAINT "syllabus_topics_parent_topic_id_fkey" FOREIGN KEY ("parent_topic_id") REFERENCES "exam"."syllabus_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam"."syllabus_topic_translations" ADD CONSTRAINT "syllabus_topic_translations_syllabus_topic_id_fkey" FOREIGN KEY ("syllabus_topic_id") REFERENCES "exam"."syllabus_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
