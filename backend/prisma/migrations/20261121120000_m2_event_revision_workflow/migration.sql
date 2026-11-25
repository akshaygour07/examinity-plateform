ALTER TABLE "exam"."exam_event_revisions"
  ADD COLUMN "revision_status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "requested_event_status" VARCHAR(30);

UPDATE "exam"."exam_event_revisions"
SET "revision_status" = 'PUBLISHED';

CREATE INDEX "exam_event_revisions_workflow_idx"
  ON "exam"."exam_event_revisions"("revision_status", "created_at");
