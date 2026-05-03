-- Migration 0003: customer_schemas (MSSQL)
-- Platform metadata tables for customer-defined schemas.

-- ── customer_schemas ───────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'customer_schemas' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[customer_schemas] (
    [id]                    UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]              INT              NOT NULL DEFAULT 1,
    [workspace_id]          UNIQUEIDENTIFIER NOT NULL,
    [name]                  NVARCHAR(255)    NOT NULL,
    [slug]                  NVARCHAR(100)    NOT NULL,
    [description]           NVARCHAR(MAX)    NULL,
    [database_driver]       NVARCHAR(10)     NOT NULL
      CONSTRAINT CK_customer_schemas_driver CHECK ([database_driver] IN ('postgres', 'mssql', 'mongo')),
    [schema_definition]     NVARCHAR(MAX)    NOT NULL DEFAULT N'{"tables":[]}',
    [current_version]       INT              NOT NULL DEFAULT 1,
    [last_deployed_version] INT              NULL,
    [last_deployed_at]      DATETIMEOFFSET   NULL,
    [_archived_at]          DATETIMEOFFSET   NULL,
    [_created_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]           UNIQUEIDENTIFIER NULL,
    [_updated_by]           UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_customer_schemas_workspace_slug UNIQUE ([workspace_id], [slug])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_customer_schemas_workspace')
BEGIN
  CREATE INDEX [idx_customer_schemas_workspace]
    ON [dbo].[customer_schemas] ([workspace_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── customer_schema_versions ───────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'customer_schema_versions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[customer_schema_versions] (
    [id]                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]          INT              NOT NULL DEFAULT 1,
    [schema_id]         UNIQUEIDENTIFIER NOT NULL
      REFERENCES [dbo].[customer_schemas]([id]) ON DELETE CASCADE,
    [version]           INT              NOT NULL,
    [schema_definition] NVARCHAR(MAX)    NOT NULL,
    [change_summary]    NVARCHAR(MAX)    NOT NULL DEFAULT N'',
    [applied_by]        UNIQUEIDENTIFIER NOT NULL,
    [applied_at]        DATETIMEOFFSET   NULL,
    [rolled_back_at]    DATETIMEOFFSET   NULL,
    [_created_at]       DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]       DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT UQ_schema_versions_schema_version UNIQUE ([schema_id], [version])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_schema_versions_schema_id')
BEGIN
  CREATE INDEX [idx_schema_versions_schema_id]
    ON [dbo].[customer_schema_versions] ([schema_id], [version] DESC);
END;
GO

-- ── customer_schema_migrations ─────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'customer_schema_migrations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[customer_schema_migrations] (
    [id]            UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]      INT              NOT NULL DEFAULT 1,
    [schema_id]     UNIQUEIDENTIFIER NOT NULL
      REFERENCES [dbo].[customer_schemas]([id]) ON DELETE CASCADE,
    [version_from]  INT              NOT NULL,
    [version_to]    INT              NOT NULL,
    [plan]          NVARCHAR(MAX)    NOT NULL DEFAULT N'{"steps":[]}',
    [status]        NVARCHAR(20)     NOT NULL DEFAULT N'planned'
      CONSTRAINT CK_schema_migrations_status
        CHECK ([status] IN ('planned', 'running', 'succeeded', 'failed', 'rolled_back')),
    [started_at]    DATETIMEOFFSET   NULL,
    [completed_at]  DATETIMEOFFSET   NULL,
    [error_details] NVARCHAR(MAX)    NULL,
    [_created_at]   DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]   DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET()
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_schema_migrations_schema_id')
BEGIN
  CREATE INDEX [idx_schema_migrations_schema_id]
    ON [dbo].[customer_schema_migrations] ([schema_id], [_created_at] DESC);
END;
GO
