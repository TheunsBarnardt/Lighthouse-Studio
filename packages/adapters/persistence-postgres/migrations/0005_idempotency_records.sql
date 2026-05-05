-- Migration 0005: idempotency_records
-- Stores cached results for idempotent mutating operations.
-- Duplicate requests within the TTL window return the stored result without
-- re-executing the operation. Cleaned up by the daily retention job.

CREATE TABLE IF NOT EXISTS idempotency_records (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version      INTEGER      NOT NULL DEFAULT 1,
  -- null for installation-scoped operations
  workspace_id  UUID,
  -- Stable name identifying the operation (e.g. 'WorkspaceService.create')
  operation     VARCHAR(255) NOT NULL,
  -- SHA-256 of "<operation>:<idempotencyKey>"; 64 hex characters
  key_hash      CHAR(64)     NOT NULL,
  -- JSON-serialised successful Result value; failures are never cached
  result_json   TEXT         NOT NULL,
  expires_at    TIMESTAMPTZ  NOT NULL,
  _archived_at  TIMESTAMPTZ,
  _created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by   UUID,
  _updated_by   UUID,
  CONSTRAINT uq_idempotency_key UNIQUE (key_hash, operation)
);

-- Expire index: the retention job uses this to efficiently delete expired records
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON idempotency_records (expires_at)
  WHERE _archived_at IS NULL;

-- Workspace scope index: used when querying by workspace
CREATE INDEX IF NOT EXISTS idx_idempotency_workspace
  ON idempotency_records (workspace_id)
  WHERE workspace_id IS NOT NULL AND _archived_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT ON idempotency_records TO app_user;
  END IF;
END $$;
