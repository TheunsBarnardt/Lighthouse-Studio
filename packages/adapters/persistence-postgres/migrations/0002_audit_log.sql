-- Migration 0002: audit_log
-- Creates the audit_log and audit_chain_state tables for tamper-evident,
-- append-only audit logging with SHA-256 hash chaining per workspace.
--
-- Permissions: app_user has INSERT on audit_log; SELECT+UPDATE on audit_chain_state.
-- Only the migration/retention user has DELETE on audit_log.

-- ── audit_chain_state ──────────────────────────────────────────────────────────
-- One row per workspace (plus one row for workspace_id IS NULL = installation chain).
-- Updated atomically on every audit event insert.

CREATE TABLE IF NOT EXISTS audit_chain_state (
  workspace_id        UUID        PRIMARY KEY,
  last_sequence       BIGINT      NOT NULL DEFAULT 0,
  last_hash           CHAR(64)    NOT NULL,
  initialized_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initialization_seed CHAR(64)    NOT NULL
);

-- ── audit_chain_state — installation chain row ─────────────────────────────────
-- Uses a sentinel UUID (all zeros) for the NULL workspace / installation chain.
-- A NULL primary key is not allowed; the zero UUID is the canonical sentinel.

INSERT INTO audit_chain_state (workspace_id, last_sequence, last_hash, initialization_seed)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  0,
  '0000000000000000000000000000000000000000000000000000000000000000',
  encode(gen_random_bytes(32), 'hex')
)
ON CONFLICT (workspace_id) DO NOTHING;

-- ── audit_log ──────────────────────────────────────────────────────────────────
-- Append-only: no _version, no _archived_at, no _updated_at.
-- Partitioned by month on occurred_at for query performance and cold archival.

CREATE TABLE IF NOT EXISTS audit_log (
  id                      UUID         NOT NULL DEFAULT gen_random_uuid(),
  sequence                BIGINT       NOT NULL,
  workspace_id            UUID,
  event_type              VARCHAR(255) NOT NULL,
  occurred_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  actor_kind              VARCHAR(20)  NOT NULL CHECK (actor_kind IN ('user', 'service_account', 'system')),
  actor_id                UUID,
  actor_identity_provider VARCHAR(100),
  actor_email_snapshot    VARCHAR(255),
  resource_type           VARCHAR(100) NOT NULL,
  resource_id             VARCHAR(255) NOT NULL,
  action                  VARCHAR(100) NOT NULL,
  outcome                 VARCHAR(10)  NOT NULL CHECK (outcome IN ('success', 'failure', 'denied')),
  reason                  TEXT,
  metadata                JSONB        NOT NULL DEFAULT '{}',
  ip_address              VARCHAR(45),
  user_agent              VARCHAR(500),
  correlation_id          VARCHAR(255) NOT NULL,
  prev_hash               CHAR(64)     NOT NULL,
  hash                    CHAR(64)     NOT NULL,
  PRIMARY KEY (workspace_id, sequence)
) PARTITION BY RANGE (occurred_at);

-- Default partition catches events that don't match any specific partition.
-- Monthly partitions are created by the maintenance job.
CREATE TABLE IF NOT EXISTS audit_log_default PARTITION OF audit_log DEFAULT;

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_time
  ON audit_log (workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_actor_time
  ON audit_log (workspace_id, actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_resource_time
  ON audit_log (workspace_id, resource_type, resource_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_event_type_time
  ON audit_log (workspace_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_correlation_id
  ON audit_log (correlation_id);

-- ── App-user permissions ───────────────────────────────────────────────────────
-- The application database user (app_user) may INSERT but not UPDATE or DELETE.
-- These grants are idempotent — safe to re-run.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT ON audit_log TO app_user;
    GRANT SELECT, UPDATE ON audit_chain_state TO app_user;
    -- Explicitly revoke destructive permissions
    REVOKE UPDATE, DELETE ON audit_log FROM app_user;
    REVOKE INSERT, DELETE ON audit_chain_state FROM app_user;
  END IF;
END $$;

-- ── Retention-user permissions ─────────────────────────────────────────────────
-- A separate audit_retention_user with DELETE may be created for the retention job.
-- Granted here if the role exists.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_retention_user') THEN
    GRANT SELECT, DELETE ON audit_log TO audit_retention_user;
  END IF;
END $$;
