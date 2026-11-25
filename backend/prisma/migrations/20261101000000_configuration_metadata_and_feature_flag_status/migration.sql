-- Migration: configuration_metadata_and_feature_flag_status
-- Decisions implemented:
--   D4 — Add setting_name, category, is_sensitive, is_editable, status, default_value,
--         validation_schema to platform.configurations.
--         The legacy `active` boolean is replaced by `status VARCHAR(20)`.
--   D5 — Add name, status to platform.feature_flags.

-- ─────────────────────────────────────────────────────────────────────────────
-- platform.configurations — D4 metadata fields
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: rename old `active` boolean to a nullable status so we can populate it
--         before adding the NOT NULL constraint.
ALTER TABLE platform.configurations
  ADD COLUMN IF NOT EXISTS setting_name      VARCHAR(200)  NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category          VARCHAR(100)  NOT NULL DEFAULT 'Platform',
  ADD COLUMN IF NOT EXISTS default_value     JSONB,
  ADD COLUMN IF NOT EXISTS validation_schema JSONB,
  ADD COLUMN IF NOT EXISTS is_sensitive      BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_editable       BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status            VARCHAR(20);

-- Step 2: migrate existing `active` boolean → status string
UPDATE platform.configurations
  SET status = CASE WHEN active = TRUE THEN 'ACTIVE' ELSE 'INACTIVE' END
  WHERE status IS NULL;

-- Step 3: make status NOT NULL and set the default
ALTER TABLE platform.configurations
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- Step 4: back-fill setting_name from config_key (human-readable form)
UPDATE platform.configurations
  SET setting_name = INITCAP(REPLACE(REPLACE(config_key, '_', ' '), '.', ' '))
  WHERE setting_name = '';

-- Step 5: drop the old `active` column (data is preserved in `status`)
ALTER TABLE platform.configurations DROP COLUMN IF EXISTS active;

-- Step 6: indexes for new columns
CREATE INDEX IF NOT EXISTS configurations_category_idx ON platform.configurations (category);
CREATE INDEX IF NOT EXISTS configurations_status_idx   ON platform.configurations (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- platform.feature_flags — D5 name + status fields
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE platform.feature_flags
  ADD COLUMN IF NOT EXISTS name   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- Back-fill defaults
UPDATE platform.feature_flags SET name   = flag_key WHERE name IS NULL;
UPDATE platform.feature_flags SET status = 'ACTIVE'  WHERE status IS NULL;

-- Apply NOT NULL + defaults
ALTER TABLE platform.feature_flags
  ALTER COLUMN name   SET NOT NULL,
  ALTER COLUMN name   SET DEFAULT '',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'ACTIVE';

-- Index
CREATE INDEX IF NOT EXISTS feature_flags_status_idx ON platform.feature_flags (status);
