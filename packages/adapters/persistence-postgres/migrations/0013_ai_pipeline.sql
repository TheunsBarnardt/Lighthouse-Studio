-- Migration 0013: ai_pipeline
-- Tables for the AI Build Pipeline Foundation (Objective 20).
-- Artifacts, usage records, cache, quality signals, and workspace AI config.

-- ── ai_artifacts ──────────────────────────────────────────────────────────────
-- Every AI-generated output (intent brief, PRD, design tokens, schema, etc.).
-- Workspace-scoped; lifecycle tracked via status enum.

CREATE TABLE IF NOT EXISTS ai_artifacts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version              INTEGER      NOT NULL DEFAULT 1,
  workspace_id          UUID         NOT NULL,
  stage                 VARCHAR(50)  NOT NULL,
  type                  VARCHAR(100) NOT NULL,
  parent_artifact_ids   JSONB        NOT NULL DEFAULT '[]',
  child_artifact_ids    JSONB        NOT NULL DEFAULT '[]',
  status                VARCHAR(30)  NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','awaiting_approval','approved','rejected','archived')),
  current_version       INTEGER      NOT NULL DEFAULT 1,
  content               JSONB        NOT NULL DEFAULT '{}',
  reasoning             JSONB        NOT NULL DEFAULT '{}',
  quality_signals       JSONB        NOT NULL DEFAULT '{"revisionCount":0,"causedDownstreamIssue":false}',
  generated_by          JSONB        NOT NULL DEFAULT '{}',
  approval_id           UUID,
  approved_at           TIMESTAMPTZ,
  approved_by_user_id   UUID,
  _archived_at          TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by           UUID,
  _updated_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_ai_artifacts_workspace_stage_status
  ON ai_artifacts (workspace_id, stage, status, _created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_artifacts_workspace_id
  ON ai_artifacts (workspace_id, _created_at DESC);

-- ── ai_artifact_versions ──────────────────────────────────────────────────────
-- Immutable version snapshots created before each content update.

CREATE TABLE IF NOT EXISTS ai_artifact_versions (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id           UUID         NOT NULL REFERENCES ai_artifacts(id) ON DELETE CASCADE,
  version               INTEGER      NOT NULL,
  content               JSONB        NOT NULL DEFAULT '{}',
  reasoning             JSONB        NOT NULL DEFAULT '{}',
  change_summary        TEXT         NOT NULL,
  edited_by_user_id     UUID,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (artifact_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_artifact
  ON ai_artifact_versions (artifact_id, version DESC);

-- ── ai_usage_records ──────────────────────────────────────────────────────────
-- Per-generation token and cost tracking for budget enforcement and reporting.

CREATE TABLE IF NOT EXISTS ai_usage_records (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL,
  user_id               UUID,
  stage                 VARCHAR(50)  NOT NULL,
  artifact_id           UUID,
  prompt_id             VARCHAR(200) NOT NULL,
  prompt_version        VARCHAR(20)  NOT NULL,
  provider              VARCHAR(50)  NOT NULL,
  model                 VARCHAR(100) NOT NULL,
  input_tokens          INTEGER      NOT NULL DEFAULT 0,
  output_tokens         INTEGER      NOT NULL DEFAULT 0,
  tool_use_tokens       INTEGER      NOT NULL DEFAULT 0,
  cost_usd              DECIMAL(10,6) NOT NULL DEFAULT 0,
  duration_ms           INTEGER      NOT NULL DEFAULT 0,
  cached                BOOLEAN      NOT NULL DEFAULT false,
  status                VARCHAR(30)  NOT NULL DEFAULT 'succeeded'
                          CHECK (status IN ('succeeded','failed','timeout','budget_exceeded')),
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_created
  ON ai_usage_records (workspace_id, _created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace_stage_created
  ON ai_usage_records (workspace_id, stage, _created_at DESC);

-- ── ai_response_cache ─────────────────────────────────────────────────────────
-- 24-hour response cache keyed by hash of (provider, model, prompts, params).
-- Cache hits bypass the token budget and cost tracking.

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key_hash        CHAR(64)     NOT NULL UNIQUE,
  prompt_id             VARCHAR(200) NOT NULL,
  prompt_version        VARCHAR(20)  NOT NULL,
  provider              VARCHAR(50)  NOT NULL,
  model                 VARCHAR(100) NOT NULL,
  response              JSONB        NOT NULL,
  expires_at            TIMESTAMPTZ  NOT NULL,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expires
  ON ai_response_cache (expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_prompt
  ON ai_response_cache (prompt_id, prompt_version);

-- ── ai_artifact_quality_records ───────────────────────────────────────────────
-- Behavioral quality signals recorded on artifact lifecycle events.
-- Feeds per-prompt quality dashboards and continuous prompt improvement.

CREATE TABLE IF NOT EXISTS ai_artifact_quality_records (
  id                          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id                 UUID         NOT NULL REFERENCES ai_artifacts(id) ON DELETE CASCADE,
  workspace_id                UUID         NOT NULL,
  stage                       VARCHAR(50)  NOT NULL,
  prompt_id                   VARCHAR(200) NOT NULL,
  prompt_version              VARCHAR(20)  NOT NULL,
  provider                    VARCHAR(50)  NOT NULL,
  model                       VARCHAR(100) NOT NULL,
  outcome                     VARCHAR(30)  NOT NULL
                                CHECK (outcome IN ('accepted_first_pass','accepted_after_revisions','rejected','abandoned')),
  revision_count              INTEGER      NOT NULL DEFAULT 0,
  edit_distance               INTEGER,
  time_to_approval_seconds    INTEGER,
  rejected_with_feedback      TEXT,
  caused_downstream_issue     BOOLEAN      NOT NULL DEFAULT false,
  _created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_quality_workspace_stage_prompt
  ON ai_artifact_quality_records (workspace_id, stage, prompt_id, prompt_version);

CREATE INDEX IF NOT EXISTS idx_ai_quality_outcome_created
  ON ai_artifact_quality_records (outcome, _created_at DESC);

-- ── ai_workspace_config ───────────────────────────────────────────────────────
-- Per-workspace AI configuration: provider, budget, PII settings.

CREATE TABLE IF NOT EXISTS ai_workspace_config (
  workspace_id                  UUID         PRIMARY KEY,
  primary_provider              VARCHAR(50)  NOT NULL DEFAULT 'anthropic',
  fallback_provider             VARCHAR(50),
  monthly_budget_usd            DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  per_stage_budget_pct          JSONB        NOT NULL DEFAULT '{}',
  pii_redaction_enabled         BOOLEAN      NOT NULL DEFAULT true,
  pii_redaction_override_consent BOOLEAN     NOT NULL DEFAULT false,
  custom_provider_credentials   JSONB        NOT NULL DEFAULT '{}',
  _version                      INTEGER      NOT NULL DEFAULT 1,
  _created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
