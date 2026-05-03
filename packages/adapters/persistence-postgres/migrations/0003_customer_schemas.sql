-- Migration 0003: customer_schemas
-- Platform metadata tables for customer-defined schemas.
-- These hold the platform's representation of schemas; actual customer tables
-- are materialized in per-workspace schemas (cust_<workspace_slug>) by the
-- migration executor when a schema is deployed.

-- ── customer_schemas ───────────────────────────────────────────────────────────
-- One row per customer-defined schema within a workspace.
-- schema_definition stores the full CustomerSchema JSON (tables, columns, etc.).

CREATE TABLE IF NOT EXISTS customer_schemas (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version              INTEGER      NOT NULL DEFAULT 1,
  workspace_id          UUID         NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(100) NOT NULL,
  description           TEXT,
  database_driver       VARCHAR(10)  NOT NULL CHECK (database_driver IN ('postgres', 'mssql', 'mongo')),
  schema_definition     JSONB        NOT NULL DEFAULT '{"tables":[]}',
  current_version       INTEGER      NOT NULL DEFAULT 1,
  last_deployed_version INTEGER,
  last_deployed_at      TIMESTAMPTZ,
  _archived_at          TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by           UUID,
  _updated_by           UUID,
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_customer_schemas_workspace
  ON customer_schemas (workspace_id)
  WHERE _archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_schemas_driver
  ON customer_schemas (workspace_id, database_driver)
  WHERE _archived_at IS NULL;

-- ── customer_schema_versions ───────────────────────────────────────────────────
-- Immutable history: one row per successful schema apply.
-- schema_definition is a snapshot of the full schema at that version.

CREATE TABLE IF NOT EXISTS customer_schema_versions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version          INTEGER      NOT NULL DEFAULT 1,
  schema_id         UUID         NOT NULL REFERENCES customer_schemas(id) ON DELETE CASCADE,
  version           INTEGER      NOT NULL,
  schema_definition JSONB        NOT NULL,
  change_summary    TEXT         NOT NULL DEFAULT '',
  applied_by        UUID         NOT NULL,
  applied_at        TIMESTAMPTZ,
  rolled_back_at    TIMESTAMPTZ,
  _created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (schema_id, version)
);

CREATE INDEX IF NOT EXISTS idx_schema_versions_schema_id
  ON customer_schema_versions (schema_id, version DESC);

-- ── customer_schema_migrations ─────────────────────────────────────────────────
-- Tracks individual migration runs (plan + execution status).

CREATE TABLE IF NOT EXISTS customer_schema_migrations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  _version      INTEGER     NOT NULL DEFAULT 1,
  schema_id     UUID        NOT NULL REFERENCES customer_schemas(id) ON DELETE CASCADE,
  version_from  INTEGER     NOT NULL,
  version_to    INTEGER     NOT NULL,
  plan          JSONB       NOT NULL DEFAULT '{"steps":[]}',
  status        VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'succeeded', 'failed', 'rolled_back')),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_details JSONB,
  _created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_schema_id
  ON customer_schema_migrations (schema_id, _created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status
  ON customer_schema_migrations (schema_id, status)
  WHERE status IN ('planned', 'running');

-- ── App-user permissions ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON customer_schemas TO app_user;
    GRANT SELECT, INSERT ON customer_schema_versions TO app_user;
    GRANT SELECT, INSERT, UPDATE ON customer_schema_migrations TO app_user;
  END IF;
END $$;
