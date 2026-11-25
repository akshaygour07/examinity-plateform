CREATE TABLE identity.api_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_fingerprint CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  device VARCHAR(50),
  browser VARCHAR(100),
  user_agent VARCHAR(500),
  ip_address VARCHAR(64),
  location VARCHAR(150),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  revoked_at TIMESTAMPTZ(6),
  revoked_by UUID,
  CONSTRAINT api_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT api_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT api_sessions_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES identity.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT api_sessions_status_check CHECK (status IN ('ACTIVE', 'REVOKED'))
);

CREATE UNIQUE INDEX api_sessions_token_fingerprint_key ON identity.api_sessions(token_fingerprint);
CREATE INDEX api_sessions_user_status_activity_idx ON identity.api_sessions(user_id, status, last_activity_at);
CREATE INDEX api_sessions_user_expiry_idx ON identity.api_sessions(user_id, expires_at);
