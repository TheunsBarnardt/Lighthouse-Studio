-- Migration 0007: generation_asset_refs
-- Stores which asset versions were consumed by each AI Pipeline generation run.
-- Enables the "would change if regenerated" staleness check (ADR-0228, criterion 5).
-- The generation_id is an opaque string owned by Obj 20 (Generation History).

CREATE TABLE IF NOT EXISTS generation_asset_refs (
  generation_id   TEXT          NOT NULL,
  asset_id        UUID          NOT NULL,
  workspace_id    UUID          NOT NULL,
  -- Version of the asset at the time it was consumed.
  asset_version   INTEGER       NOT NULL,
  category        VARCHAR(32)   NOT NULL,
  top_level       VARCHAR(16)   NOT NULL,
  filename        VARCHAR(512)  NOT NULL,
  recorded_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (generation_id, asset_id)
);

-- Lookup all refs for a generation (used by checkStaleness)
CREATE INDEX IF NOT EXISTS idx_gen_asset_refs_generation
  ON generation_asset_refs (generation_id);

-- Lookup all generations that consumed a specific asset (used for "what would change")
CREATE INDEX IF NOT EXISTS idx_gen_asset_refs_asset
  ON generation_asset_refs (workspace_id, asset_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT ON generation_asset_refs TO app_user;
  END IF;
END $$;
