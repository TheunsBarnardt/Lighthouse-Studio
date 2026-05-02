-- Migration 0000: initial
-- Creates the platform migrations tracking table.
-- All subsequent migrations are tracked in this table by the migration runner.

CREATE TABLE IF NOT EXISTS __platform_migrations (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  checksum    VARCHAR(64)  NOT NULL,
  applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
