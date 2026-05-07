-- Migration 0009: intent_capture (MSSQL)
-- Creates intent_brief_templates table for Objective 21.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'intent_brief_templates' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[intent_brief_templates] (
    [id]                    UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [workspace_id]          UNIQUEIDENTIFIER  NULL,
    [name]                  NVARCHAR(255)     NOT NULL,
    [description]           NVARCHAR(MAX)     NOT NULL DEFAULT '',
    [category]              NVARCHAR(100)     NOT NULL DEFAULT 'general',
    [starter_message]       NVARCHAR(MAX)     NOT NULL,
    [suggested_focus_areas] NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
    [built_in]              BIT               NOT NULL DEFAULT 0,
    [created_by_user_id]    UNIQUEIDENTIFIER  NULL,
    [_version]              INT               NOT NULL DEFAULT 1,
    [_archived_at]          DATETIMEOFFSET    NULL,
    [_created_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_intent_brief_templates_workspace')
BEGIN
  CREATE INDEX [idx_intent_brief_templates_workspace]
    ON [dbo].[intent_brief_templates] ([workspace_id])
    WHERE [_archived_at] IS NULL;
END;
GO
