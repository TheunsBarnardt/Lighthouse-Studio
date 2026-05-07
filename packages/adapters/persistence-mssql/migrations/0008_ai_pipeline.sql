-- Migration 0008: ai_pipeline (MSSQL)
-- Creates tables for the AI Build Pipeline Foundation (Objective 20).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_artifacts' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_artifacts] (
    [id]                    UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [workspace_id]          UNIQUEIDENTIFIER  NOT NULL,
    [stage]                 NVARCHAR(50)      NOT NULL,
    [type]                  NVARCHAR(100)     NOT NULL,
    [parent_artifact_ids]   NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
    [child_artifact_ids]    NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
    [status]                NVARCHAR(30)      NOT NULL DEFAULT 'draft'
                              CONSTRAINT [CK_ai_artifacts_status] CHECK ([status] IN ('draft','awaiting_approval','approved','rejected','archived')),
    [current_version]       INT               NOT NULL DEFAULT 1,
    [content]               NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [reasoning]             NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [quality_signals]       NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [generated_by]          NVARCHAR(MAX)     NULL,
    [approval_id]           UNIQUEIDENTIFIER  NULL,
    [created_by_user_id]    UNIQUEIDENTIFIER  NULL,
    [approved_at]           DATETIMEOFFSET    NULL,
    [approved_by_user_id]   UNIQUEIDENTIFIER  NULL,
    [_version]              INT               NOT NULL DEFAULT 1,
    [_archived_at]          DATETIMEOFFSET    NULL,
    [_created_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_artifacts_workspace_stage_status')
BEGIN
  CREATE INDEX [idx_ai_artifacts_workspace_stage_status]
    ON [dbo].[ai_artifacts] ([workspace_id], [stage], [status])
    WHERE [_archived_at] IS NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_artifacts_workspace_updated')
BEGIN
  CREATE INDEX [idx_ai_artifacts_workspace_updated]
    ON [dbo].[ai_artifacts] ([workspace_id], [_updated_at] DESC)
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── ai_usage_records ──────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_usage_records' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_usage_records] (
    [id]              UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [workspace_id]    UNIQUEIDENTIFIER  NOT NULL,
    [user_id]         UNIQUEIDENTIFIER  NULL,
    [stage]           NVARCHAR(50)      NOT NULL,
    [artifact_id]     UNIQUEIDENTIFIER  NULL,
    [prompt_id]       NVARCHAR(255)     NOT NULL,
    [prompt_version]  NVARCHAR(50)      NOT NULL,
    [provider]        NVARCHAR(100)     NOT NULL,
    [model]           NVARCHAR(255)     NOT NULL,
    [input_tokens]    INT               NOT NULL DEFAULT 0,
    [output_tokens]   INT               NOT NULL DEFAULT 0,
    [tool_use_tokens] INT               NOT NULL DEFAULT 0,
    [cost_usd]        DECIMAL(10,6)     NOT NULL DEFAULT 0,
    [duration_ms]     INT               NOT NULL DEFAULT 0,
    [cached]          BIT               NOT NULL DEFAULT 0,
    [status]          NVARCHAR(30)      NOT NULL DEFAULT 'succeeded',
    [_created_at]     DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_usage_workspace_created')
BEGIN
  CREATE INDEX [idx_ai_usage_workspace_created]
    ON [dbo].[ai_usage_records] ([workspace_id], [_created_at] DESC);
END;
GO

-- ── ai_response_cache ─────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_response_cache' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[ai_response_cache] (
    [id]            UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [cache_key]     NVARCHAR(64)      NOT NULL,
    [workspace_id]  UNIQUEIDENTIFIER  NOT NULL,
    [prompt_id]     NVARCHAR(255)     NOT NULL,
    [response_json] NVARCHAR(MAX)     NOT NULL,
    [expires_at]    DATETIMEOFFSET    NOT NULL,
    [hit_count]     INT               NOT NULL DEFAULT 0,
    [_created_at]   DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]   DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_ai_response_cache_key] UNIQUE ([cache_key])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ai_response_cache_expires')
BEGIN
  CREATE INDEX [idx_ai_response_cache_expires]
    ON [dbo].[ai_response_cache] ([expires_at]);
END;
GO
