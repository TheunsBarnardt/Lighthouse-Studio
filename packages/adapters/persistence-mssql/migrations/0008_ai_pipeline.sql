-- Migration 0008: ai_pipeline (MSSQL)
-- Tables for the AI Build Pipeline Foundation (Objective 20).
-- Artifacts, usage records, cache, quality signals, and workspace AI config.

-- ── ai_artifacts ──────────────────────────────────────────────────────────────
-- Every AI-generated output (intent brief, PRD, design tokens, schema, etc.).
-- Workspace-scoped; lifecycle tracked via status enum.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_artifacts' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_artifacts] (
    [id]                    UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]              INT               NOT NULL DEFAULT 1,
    [workspace_id]          UNIQUEIDENTIFIER  NOT NULL,
    [stage]                 NVARCHAR(50)      NOT NULL,
    [type]                  NVARCHAR(100)     NOT NULL,
    [parent_artifact_ids]   NVARCHAR(MAX)     NOT NULL DEFAULT '[]',   -- JSON
    [child_artifact_ids]    NVARCHAR(MAX)     NOT NULL DEFAULT '[]',   -- JSON
    [status]                NVARCHAR(30)      NOT NULL DEFAULT 'draft'
      CONSTRAINT [CK_ai_artifacts_status] CHECK ([status] IN ('draft','awaiting_approval','approved','rejected','archived')),
    [current_version]       INT               NOT NULL DEFAULT 1,
    [content]               NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [reasoning]             NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [quality_signals]       NVARCHAR(MAX)     NOT NULL DEFAULT '{"revisionCount":0,"causedDownstreamIssue":false}', -- JSON
    [generated_by]          NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [approval_id]           UNIQUEIDENTIFIER  NULL,
    [approved_at]           DATETIMEOFFSET    NULL,
    [approved_by_user_id]   UNIQUEIDENTIFIER  NULL,
    [_archived_at]          DATETIMEOFFSET    NULL,
    [_created_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]           UNIQUEIDENTIFIER  NULL,
    [_updated_by]           UNIQUEIDENTIFIER  NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_artifacts_workspace_stage_status' AND object_id = OBJECT_ID('dbo.ai_artifacts'))
  CREATE INDEX [idx_ai_artifacts_workspace_stage_status]
    ON [dbo].[ai_artifacts] ([workspace_id], [stage], [status], [_created_at] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_artifacts_workspace_id' AND object_id = OBJECT_ID('dbo.ai_artifacts'))
  CREATE INDEX [idx_ai_artifacts_workspace_id]
    ON [dbo].[ai_artifacts] ([workspace_id], [_created_at] DESC);
GO

-- ── ai_artifact_versions ──────────────────────────────────────────────────────
-- Immutable version snapshots created before each content update.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_artifact_versions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_artifact_versions] (
    [id]                UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [artifact_id]       UNIQUEIDENTIFIER  NOT NULL,
    [version]           INT               NOT NULL,
    [content]           NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [reasoning]         NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [change_summary]    NVARCHAR(MAX)     NOT NULL,
    [edited_by_user_id] UNIQUEIDENTIFIER  NULL,
    [_created_at]       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_ai_artifact_versions_artifact_version] UNIQUE ([artifact_id], [version]),
    CONSTRAINT [FK_ai_artifact_versions_artifact] FOREIGN KEY ([artifact_id])
      REFERENCES [dbo].[ai_artifacts] ([id]) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_artifact_versions_artifact' AND object_id = OBJECT_ID('dbo.ai_artifact_versions'))
  CREATE INDEX [idx_ai_artifact_versions_artifact]
    ON [dbo].[ai_artifact_versions] ([artifact_id], [version] DESC);
GO

-- ── ai_usage_records ──────────────────────────────────────────────────────────
-- Per-generation token and cost tracking for budget enforcement and reporting.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_usage_records' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_usage_records] (
    [id]                UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [workspace_id]      UNIQUEIDENTIFIER  NOT NULL,
    [user_id]           UNIQUEIDENTIFIER  NULL,
    [stage]             NVARCHAR(50)      NOT NULL,
    [artifact_id]       UNIQUEIDENTIFIER  NULL,
    [prompt_id]         NVARCHAR(200)     NOT NULL,
    [prompt_version]    NVARCHAR(20)      NOT NULL,
    [provider]          NVARCHAR(50)      NOT NULL,
    [model]             NVARCHAR(100)     NOT NULL,
    [input_tokens]      INT               NOT NULL DEFAULT 0,
    [output_tokens]     INT               NOT NULL DEFAULT 0,
    [tool_use_tokens]   INT               NOT NULL DEFAULT 0,
    [cost_usd]          DECIMAL(10,6)     NOT NULL DEFAULT 0,
    [duration_ms]       INT               NOT NULL DEFAULT 0,
    [cached]            BIT               NOT NULL DEFAULT 0,
    [status]            NVARCHAR(30)      NOT NULL DEFAULT 'succeeded'
      CONSTRAINT [CK_ai_usage_records_status] CHECK ([status] IN ('succeeded','failed','timeout','budget_exceeded')),
    [_created_at]       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_usage_workspace_created' AND object_id = OBJECT_ID('dbo.ai_usage_records'))
  CREATE INDEX [idx_ai_usage_workspace_created]
    ON [dbo].[ai_usage_records] ([workspace_id], [_created_at] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_usage_workspace_stage_created' AND object_id = OBJECT_ID('dbo.ai_usage_records'))
  CREATE INDEX [idx_ai_usage_workspace_stage_created]
    ON [dbo].[ai_usage_records] ([workspace_id], [stage], [_created_at] DESC);
GO

-- ── ai_response_cache ─────────────────────────────────────────────────────────
-- 24-hour response cache keyed by hash of (provider, model, prompts, params).
-- Cache hits bypass the token budget and cost tracking.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_response_cache' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_response_cache] (
    [id]                UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [cache_key_hash]    CHAR(64)          NOT NULL,
    [prompt_id]         NVARCHAR(200)     NOT NULL,
    [prompt_version]    NVARCHAR(20)      NOT NULL,
    [provider]          NVARCHAR(50)      NOT NULL,
    [model]             NVARCHAR(100)     NOT NULL,
    [response]          NVARCHAR(MAX)     NOT NULL,                  -- JSON
    [expires_at]        DATETIMEOFFSET    NOT NULL,
    [_created_at]       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_ai_response_cache_key_hash] UNIQUE ([cache_key_hash])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_response_cache_expires' AND object_id = OBJECT_ID('dbo.ai_response_cache'))
  CREATE INDEX [idx_ai_response_cache_expires]
    ON [dbo].[ai_response_cache] ([expires_at]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_response_cache_prompt' AND object_id = OBJECT_ID('dbo.ai_response_cache'))
  CREATE INDEX [idx_ai_response_cache_prompt]
    ON [dbo].[ai_response_cache] ([prompt_id], [prompt_version]);
GO

-- ── ai_artifact_quality_records ───────────────────────────────────────────────
-- Behavioral quality signals recorded on artifact lifecycle events.
-- Feeds per-prompt quality dashboards and continuous prompt improvement.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_artifact_quality_records' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_artifact_quality_records] (
    [id]                        UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [artifact_id]               UNIQUEIDENTIFIER  NOT NULL,
    [workspace_id]              UNIQUEIDENTIFIER  NOT NULL,
    [stage]                     NVARCHAR(50)      NOT NULL,
    [prompt_id]                 NVARCHAR(200)     NOT NULL,
    [prompt_version]            NVARCHAR(20)      NOT NULL,
    [provider]                  NVARCHAR(50)      NOT NULL,
    [model]                     NVARCHAR(100)     NOT NULL,
    [outcome]                   NVARCHAR(30)      NOT NULL
      CONSTRAINT [CK_ai_artifact_quality_records_outcome] CHECK ([outcome] IN ('accepted_first_pass','accepted_after_revisions','rejected','abandoned')),
    [revision_count]            INT               NOT NULL DEFAULT 0,
    [edit_distance]             INT               NULL,
    [time_to_approval_seconds]  INT               NULL,
    [rejected_with_feedback]    NVARCHAR(MAX)     NULL,
    [caused_downstream_issue]   BIT               NOT NULL DEFAULT 0,
    [_created_at]               DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [FK_ai_artifact_quality_records_artifact] FOREIGN KEY ([artifact_id])
      REFERENCES [dbo].[ai_artifacts] ([id]) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_quality_workspace_stage_prompt' AND object_id = OBJECT_ID('dbo.ai_artifact_quality_records'))
  CREATE INDEX [idx_ai_quality_workspace_stage_prompt]
    ON [dbo].[ai_artifact_quality_records] ([workspace_id], [stage], [prompt_id], [prompt_version]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_quality_outcome_created' AND object_id = OBJECT_ID('dbo.ai_artifact_quality_records'))
  CREATE INDEX [idx_ai_quality_outcome_created]
    ON [dbo].[ai_artifact_quality_records] ([outcome], [_created_at] DESC);
GO

-- ── ai_workspace_config ───────────────────────────────────────────────────────
-- Per-workspace AI configuration: provider, budget, PII settings.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_workspace_config' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_workspace_config] (
    [workspace_id]                    UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY,
    [primary_provider]                NVARCHAR(50)      NOT NULL DEFAULT 'anthropic',
    [fallback_provider]               NVARCHAR(50)      NULL,
    [monthly_budget_usd]              DECIMAL(10,2)     NOT NULL DEFAULT 50.00,
    [per_stage_budget_pct]            NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [pii_redaction_enabled]           BIT               NOT NULL DEFAULT 1,
    [pii_redaction_override_consent]  BIT               NOT NULL DEFAULT 0,
    [custom_provider_credentials]     NVARCHAR(MAX)     NOT NULL DEFAULT '{}',   -- JSON
    [_version]                        INT               NOT NULL DEFAULT 1,
    [_created_at]                     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]                     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO
