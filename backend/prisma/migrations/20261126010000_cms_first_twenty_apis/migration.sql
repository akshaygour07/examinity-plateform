CREATE SCHEMA IF NOT EXISTS cms;

CREATE TABLE cms.cms_content_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
  description TEXT, schema_config JSONB NOT NULL DEFAULT '{}', requires_review BOOLEAN NOT NULL DEFAULT true,
  requires_verification BOOLEAN NOT NULL DEFAULT true, requires_approval BOOLEAN NOT NULL DEFAULT true,
  requires_category BOOLEAN NOT NULL DEFAULT true, requires_exam_association BOOLEAN NOT NULL DEFAULT false,
  requires_source BOOLEAN NOT NULL DEFAULT false, is_active BOOLEAN NOT NULL DEFAULT true, display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE cms.cms_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), content_type_id UUID NOT NULL REFERENCES cms.cms_content_types(id) ON DELETE RESTRICT,
  content_key VARCHAR(100) NOT NULL UNIQUE, default_locale VARCHAR(10) NOT NULL DEFAULT 'en', owner_user_id UUID NOT NULL,
  status VARCHAR(40) NOT NULL, current_revision_id UUID, published_revision_id UUID,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ(6), deleted_at TIMESTAMPTZ(6)
);
CREATE TABLE cms.cms_content_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), content_item_id UUID NOT NULL REFERENCES cms.cms_content_items(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1), locale VARCHAR(10) NOT NULL, title VARCHAR(300) NOT NULL,
  slug VARCHAR(350) NOT NULL, summary VARCHAR(1000), body JSONB NOT NULL, plain_text TEXT, status VARCHAR(40) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1), created_by_user_id UUID NOT NULL, submitted_at TIMESTAMPTZ(6),
  published_at TIMESTAMPTZ(6), created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(content_item_id, locale, revision_number)
);
ALTER TABLE cms.cms_content_items ADD CONSTRAINT cms_content_items_current_revision_fkey FOREIGN KEY (current_revision_id) REFERENCES cms.cms_content_revisions(id) ON DELETE SET NULL;
ALTER TABLE cms.cms_content_items ADD CONSTRAINT cms_content_items_published_revision_fkey FOREIGN KEY (published_revision_id) REFERENCES cms.cms_content_revisions(id) ON DELETE SET NULL;
CREATE TABLE cms.cms_workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), revision_id UUID NOT NULL UNIQUE REFERENCES cms.cms_content_revisions(id) ON DELETE RESTRICT,
  state VARCHAR(40) NOT NULL, submitted_by_user_id UUID NOT NULL, submitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE cms.cms_workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workflow_instance_id UUID NOT NULL REFERENCES cms.cms_workflow_instances(id) ON DELETE RESTRICT,
  task_type VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL, assigned_to_user_id UUID, assigned_by_user_id UUID,
  due_at TIMESTAMPTZ(6), completed_at TIMESTAMPTZ(6), created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE cms.cms_content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workflow_task_id UUID NOT NULL REFERENCES cms.cms_workflow_tasks(id) ON DELETE RESTRICT,
  decision VARCHAR(30) NOT NULL, comments TEXT, field_comments JSONB NOT NULL DEFAULT '[]', decided_by_user_id UUID NOT NULL,
  decided_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX cms_content_items_type_status_idx ON cms.cms_content_items(content_type_id, status);
CREATE INDEX cms_content_items_owner_status_idx ON cms.cms_content_items(owner_user_id, status);
CREATE INDEX cms_content_items_updated_idx ON cms.cms_content_items(updated_at);
CREATE INDEX cms_content_revisions_item_locale_number_idx ON cms.cms_content_revisions(content_item_id, locale, revision_number DESC);
CREATE INDEX cms_content_revisions_status_updated_idx ON cms.cms_content_revisions(status, updated_at DESC);
CREATE INDEX cms_workflow_instances_state_idx ON cms.cms_workflow_instances(state);
CREATE INDEX cms_workflow_tasks_type_status_idx ON cms.cms_workflow_tasks(task_type, status);
CREATE INDEX cms_workflow_tasks_assignee_status_idx ON cms.cms_workflow_tasks(assigned_to_user_id, status);
