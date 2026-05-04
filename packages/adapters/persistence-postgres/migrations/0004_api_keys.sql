-- Migration 0004: api_keys
-- Platform-managed API keys for server-to-server access to the customer data API.
-- Keys are stored as HMAC-SHA-256 hashes; the plaintext is returned once on creation.

CREATE TABLE IF NOT EXISTS api_keys (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version            INTEGER      NOT NULL DEFAULT 1,
  workspace_id        UUID         NOT NULL,
  name                VARCHAR(255) NOT NULL,
  -- First 8 characters of the key (after the pkey_ prefix); used for lookup.
  key_prefix          CHAR(8)      NOT NULL,
  -- HMAC-SHA-256 of the full raw key; 64 hex characters.
  key_hash            CHAR(64)     NOT NULL,
  -- Optional permission overrides; null means "inherit creator's permissions".
  permissions         JSONB,
  expires_at          TIMESTAMPTZ,
  last_used_at        TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_by_user_id  UUID         NOT NULL,
  _archived_at        TIMESTAMPTZ,
  _created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_api_keys_hash UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace
  ON api_keys (workspace_id)
  WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- Lookup by prefix (step 1 of verify: narrow candidates before HMAC comparison).
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix
  ON api_keys (workspace_id, key_prefix)
  WHERE revoked_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON api_keys TO app_user;
  END IF;
END $$;
