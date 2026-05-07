-- Migration 0011: query_console
-- Creates tables for query history and saved queries (Objective 17).

CREATE TABLE IF NOT EXISTS query_history (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL,
  user_id           UUID        NOT NULL,
  query_text        TEXT        NOT NULL,
  query_language    VARCHAR(50) NOT NULL,  -- 'sql_postgres'|'sql_mssql'|'mongo_aggregate'|'mongo_find'
  parameters        JSONB,
  duration_ms       INTEGER     NOT NULL,
  rows_affected     INTEGER,
  error_message     TEXT,
  status            VARCHAR(20) NOT NULL,  -- 'succeeded'|'failed'|'timeout'|'cancelled'
  result_summary    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS query_history_user_idx
  ON query_history(workspace_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS query_history_ws_idx
  ON query_history(workspace_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_queries (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL,
  created_by_user_id    UUID         NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  query_text            TEXT         NOT NULL,
  query_language        VARCHAR(50)  NOT NULL,
  default_parameters    JSONB,
  folder_path           VARCHAR(500),
  shared                BOOLEAN      NOT NULL DEFAULT FALSE,
  shared_can_run        BOOLEAN      NOT NULL DEFAULT FALSE,
  version               INTEGER      NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT saved_queries_unique_name
    UNIQUE (workspace_id, created_by_user_id, name)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS saved_queries_shared_idx
  ON saved_queries(workspace_id, shared)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS saved_queries_folder_idx
  ON saved_queries(workspace_id, folder_path)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS saved_queries_owner_idx
  ON saved_queries(workspace_id, created_by_user_id)
  WHERE deleted_at IS NULL;

-- ── Per-workspace console DB roles ────────────────────────────────────────────
-- Creates readonly and console_writer Postgres roles for each workspace.
-- Called by the workspace provisioning code when a new workspace is created.
-- Roles are scoped to the workspace's customer schema (cust_<slug>).
--
-- Usage: SELECT provision_console_roles('my_workspace_slug');
--
CREATE OR REPLACE FUNCTION provision_console_roles(workspace_slug TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT := 'cust_' || workspace_slug;
  role_readonly TEXT := 'cust_' || workspace_slug || '_readonly';
  role_writer   TEXT := 'cust_' || workspace_slug || '_console_writer';
BEGIN
  -- readonly role: SELECT only
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_readonly) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', role_readonly);
  END IF;
  EXECUTE format(
    'GRANT USAGE ON SCHEMA %I TO %I',
    schema_name, role_readonly
  );
  EXECUTE format(
    'GRANT SELECT ON ALL TABLES IN SCHEMA %I TO %I',
    schema_name, role_readonly
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO %I',
    schema_name, role_readonly
  );

  -- console_writer role: SELECT + DML (no DDL)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_writer) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', role_writer);
  END IF;
  EXECUTE format(
    'GRANT USAGE ON SCHEMA %I TO %I',
    schema_name, role_writer
  );
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I',
    schema_name, role_writer
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    schema_name, role_writer
  );
END;
$$;

-- ── History retention: cleanup index ─────────────────────────────────────────
-- Used by the nightly retention job to efficiently delete old history rows.
CREATE INDEX IF NOT EXISTS query_history_retention_idx
  ON query_history(workspace_id, user_id, created_at)
  WHERE deleted_at IS NULL;

-- ── History retention: cleanup function ───────────────────────────────────────
-- Deletes query_history rows older than retention_days.
-- Schedule via pg_cron: SELECT cron.schedule('query-history-retention',
--   '0 2 * * *', $$SELECT purge_query_history(90)$$);
CREATE OR REPLACE FUNCTION purge_query_history(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM query_history
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND deleted_at IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
