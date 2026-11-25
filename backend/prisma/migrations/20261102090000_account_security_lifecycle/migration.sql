-- D2/D8: persist shared account suspension/lock lifecycle state on identity.users.
-- Access tokens issued before access_valid_after are rejected by the API after
-- suspension, disablement, locking, reinstatement, or unlock.
ALTER TABLE identity.users
  ADD COLUMN suspension_reason VARCHAR(1000),
  ADD COLUMN suspension_category VARCHAR(30),
  ADD COLUMN restriction_cleared_at TIMESTAMPTZ(6),
  ADD COLUMN locked_at TIMESTAMPTZ(6),
  ADD COLUMN lock_reason VARCHAR(1000),
  ADD COLUMN locked_until TIMESTAMPTZ(6),
  ADD COLUMN unlocked_at TIMESTAMPTZ(6),
  ADD COLUMN access_valid_after TIMESTAMPTZ(6);

ALTER TABLE identity.users
  ADD CONSTRAINT users_suspension_category_check
  CHECK (suspension_category IS NULL OR suspension_category IN ('ROUTINE', 'SECURITY', 'FRAUD', 'LEGAL', 'INVESTIGATION'));
