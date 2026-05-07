-- Migration 0013: ai_pipeline
-- Creates tables for the AI Build Pipeline Foundation (Objective 20):
--   ai_artifacts, ai_usage_records, ai_response_cache

-- ── ai_artifacts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_artifacts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL,
  stage                 VARCHAR(50)  NOT NULL,
  type                  VARCHAR(100) NOT NULL,
  parent_artifact_ids   JSONB        NOT NULL DEFAULT '[]',
  child_artifact_ids    JSONB        NOT NULL DEFAULT '[]',
  status                VARCHAR(30)  NOT NULL DEFAULT 'draft',
  -- 'draft'|'awaiting_approval'|'approved'|'rejected'|'archived'
  current_version       INTEGER      NOT NULL DEFAULT 1,
  content               JSONB        NOT NULL DEFAULT '{}',
  reasoning             JSONB        NOT NULL DEFAULT '{}',
  quality_signals       JSONB        NOT NULL DEFAULT '{}',
  generated_by          JSONB,
  approval_id           UUID,
  created_by_user_id    UUID,
  approved_at           TIMESTAMPTZ,
  approved_by_user_id   UUID,
  _version              INTEGER      NOT NULL DEFAULT 1,
  _archived_at          TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_artifacts_workspace_stage_status_idx
  ON ai_artifacts(workspace_id, stage, status)
  WHERE _archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ai_artifacts_workspace_updated_idx
  ON ai_artifacts(workspace_id, _updated_at DESC)
  WHERE _archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ai_artifacts_approval_idx
  ON ai_artifacts(workspace_id, approval_id)
  WHERE approval_id IS NOT NULL AND _archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ai_artifacts_parent_ids_idx
  ON ai_artifacts USING GIN(parent_artifact_ids)
  WHERE _archived_at IS NULL;

-- ── ai_usage_records ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage_records (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID         NOT NULL,
  user_id           UUID,
  stage             VARCHAR(50)  NOT NULL,
  artifact_id       UUID,
  prompt_id         VARCHAR(255) NOT NULL,
  prompt_version    VARCHAR(50)  NOT NULL,
  provider          VARCHAR(100) NOT NULL,
  model             VARCHAR(255) NOT NULL,
  input_tokens      INTEGER      NOT NULL DEFAULT 0,
  output_tokens     INTEGER      NOT NULL DEFAULT 0,
  tool_use_tokens   INTEGER      NOT NULL DEFAULT 0,
  cost_usd          NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms       INTEGER      NOT NULL DEFAULT 0,
  cached            BOOLEAN      NOT NULL DEFAULT FALSE,
  status            VARCHAR(30)  NOT NULL DEFAULT 'succeeded',
  -- 'succeeded'|'failed'|'timeout'|'budget_exceeded'
  _created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_workspace_created_idx
  ON ai_usage_records(workspace_id, _created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_workspace_stage_created_idx
  ON ai_usage_records(workspace_id, stage, _created_at DESC);

-- ── ai_response_cache ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_response_cache (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       VARCHAR(64)   NOT NULL,
  workspace_id    UUID          NOT NULL,
  prompt_id       VARCHAR(255)  NOT NULL,
  response_json   JSONB         NOT NULL,
  expires_at      TIMESTAMPTZ   NOT NULL,
  hit_count       INTEGER       NOT NULL DEFAULT 0,
  _created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  _updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_response_cache_unique_key UNIQUE (cache_key)
);

CREATE INDEX IF NOT EXISTS ai_response_cache_expires_idx
  ON ai_response_cache(expires_at);

CREATE INDEX IF NOT EXISTS ai_response_cache_workspace_prompt_idx
  ON ai_response_cache(workspace_id, prompt_id);
