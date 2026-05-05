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
