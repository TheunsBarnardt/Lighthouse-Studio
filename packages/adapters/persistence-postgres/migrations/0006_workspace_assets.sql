-- Migration 0006: workspace_assets
-- Workspace-level brand assets and reference documents for the AI Pipeline.
-- Blobs live in object storage; this table holds metadata, quota, and validation state.
-- See ADR-0226 for storage layout decisions.

CREATE TABLE IF NOT EXISTS workspace_assets (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  _version            INTEGER       NOT NULL DEFAULT 1,
  workspace_id        UUID          NOT NULL,
  top_level           VARCHAR(16)   NOT NULL CHECK (top_level IN ('brand', 'documents')),
  category            VARCHAR(32)   NOT NULL,
  role                VARCHAR(128),
  filename            VARCHAR(512)  NOT NULL,
  mime_type           VARCHAR(255)  NOT NULL,
  size_bytes          BIGINT        NOT NULL CHECK (size_bytes >= 0),
  -- Full path in object storage: /workspaces/{workspace_id}/assets/{top_level}/{category}/{id}/{filename}
  storage_key         TEXT          NOT NULL,
  -- Path to extracted plain-text blob; populated for parseable document formats.
  parsed_text_key     TEXT,
  validation_status   VARCHAR(32)   NOT NULL DEFAULT 'pending'
                        CHECK (validation_status IN ('pending', 'valid', 'invalid', 'unsupported_format')),
  validation_reason   TEXT,
  uploaded_by         UUID          NOT NULL,
  _archived_at        TIMESTAMPTZ,
  _created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  _updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Lookup by workspace + category (the primary query pattern)
CREATE INDEX IF NOT EXISTS idx_workspace_assets_workspace_category
  ON workspace_assets (workspace_id, top_level, category)
  WHERE _archived_at IS NULL;

-- Lookup by workspace + updatedAt desc (used by listByContext, ordered by recency)
CREATE INDEX IF NOT EXISTS idx_workspace_assets_workspace_updated
  ON workspace_assets (workspace_id, _updated_at DESC)
  WHERE _archived_at IS NULL;

-- ── Quota tracking ─────────────────────────────────────────────────────────────
-- Add assets_bytes_used to workspaces table (incremented/decremented by service).
-- Default 1 GiB allowance; configurable via workspace settings.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS assets_bytes_used    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assets_allowance_bytes BIGINT NOT NULL DEFAULT 1073741824;

-- ── Permissions ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON workspace_assets TO app_user;
    -- UPDATE on workspaces is already granted by migration 0001;
    -- no additional grant needed for the quota columns.
  END IF;
END $$;
