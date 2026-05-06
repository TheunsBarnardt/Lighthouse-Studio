-- Migration 0012: data_browser
-- Creates tables for saved views and import/export jobs (Objective 18).

-- ── data_browser_views ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_browser_views (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL,
  schema_id             UUID         NOT NULL,
  table_id              VARCHAR(255) NOT NULL,
  created_by_user_id    UUID         NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  filter_config         JSONB,
  sort_config           JSONB,
  visible_columns       JSONB,
  shared                BOOLEAN      NOT NULL DEFAULT FALSE,
  version               INTEGER      NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID,
  updated_by            UUID,
  CONSTRAINT data_browser_views_unique_name
    UNIQUE (workspace_id, schema_id, table_id, created_by_user_id, name)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS data_browser_views_workspace_idx
  ON data_browser_views(workspace_id, schema_id, table_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS data_browser_views_shared_idx
  ON data_browser_views(workspace_id, shared)
  WHERE deleted_at IS NULL AND shared = TRUE;

-- ── import_jobs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL,
  schema_id             UUID         NOT NULL,
  table_id              VARCHAR(255) NOT NULL,
  initiated_by_user_id  UUID         NOT NULL,
  source_file_id        UUID         NOT NULL,
  column_mapping        JSONB        NOT NULL DEFAULT '{}',
  on_error              VARCHAR(20)  NOT NULL DEFAULT 'skip',  -- 'skip'|'fail'
  status                VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- 'pending'|'validating'|'importing'|'completed'|'failed'|'cancelled'
  total_rows            INTEGER,
  imported_rows         INTEGER      NOT NULL DEFAULT 0,
  skipped_rows          INTEGER      NOT NULL DEFAULT 0,
  error_file_id         UUID,
  error_summary         JSONB,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  version               INTEGER      NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID,
  updated_by            UUID
);

CREATE INDEX IF NOT EXISTS import_jobs_workspace_idx
  ON import_jobs(workspace_id, initiated_by_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS import_jobs_status_idx
  ON import_jobs(status, created_at)
  WHERE deleted_at IS NULL AND status IN ('pending', 'validating', 'importing');

-- ── export_jobs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS export_jobs (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL,
  schema_id             UUID         NOT NULL,
  table_id              VARCHAR(255) NOT NULL,
  initiated_by_user_id  UUID         NOT NULL,
  filter_config         JSONB,
  sort_config           JSONB,
  format                VARCHAR(10)  NOT NULL DEFAULT 'csv',  -- 'csv'|'json'
  scope                 VARCHAR(20)  NOT NULL DEFAULT 'filtered', -- 'filtered'|'all'
  status                VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- 'pending'|'exporting'|'completed'|'failed'
  total_rows            INTEGER,
  exported_rows         INTEGER      NOT NULL DEFAULT 0,
  output_file_id        UUID,
  signed_url            TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  version               INTEGER      NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID,
  updated_by            UUID
);

CREATE INDEX IF NOT EXISTS export_jobs_workspace_idx
  ON export_jobs(workspace_id, initiated_by_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS export_jobs_status_idx
  ON export_jobs(status, created_at)
  WHERE deleted_at IS NULL AND status IN ('pending', 'exporting');
