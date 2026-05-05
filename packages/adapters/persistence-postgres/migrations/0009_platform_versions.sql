-- Migration 0009: platform_versions
-- Append-only audit log of platform release-version upgrades.
-- Distinct from __platform_migrations (which tracks SCHEMA migrations).
-- This table records each PLATFORM RELEASE that ran against the database,
-- so the upgrade orchestrator (Objective 9.5) can determine the current version
-- and decide whether an incoming upgrade is in-policy.

CREATE TABLE IF NOT EXISTS platform_versions (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  release_version             VARCHAR(64)   NOT NULL,
  applied_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  applied_by                  UUID,
  schema_migration_high_water VARCHAR(128),
  notes                       TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_versions_applied_at
  ON platform_versions (applied_at DESC);
