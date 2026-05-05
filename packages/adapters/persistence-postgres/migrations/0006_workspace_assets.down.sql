-- Rollback migration 0006: workspace_assets

ALTER TABLE workspaces
  DROP COLUMN IF EXISTS assets_bytes_used,
  DROP COLUMN IF EXISTS assets_allowance_bytes;

DROP TABLE IF EXISTS workspace_assets;
