-- Migration 0005: idempotency_records (MSSQL)
-- Stores cached results for idempotent mutating operations.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'idempotency_records' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[idempotency_records] (
    [id]           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]     INT              NOT NULL DEFAULT 1,
    -- null for installation-scoped operations
    [workspace_id] UNIQUEIDENTIFIER NULL,
    -- Stable operation name (e.g. 'WorkspaceService.create')
    [operation]    NVARCHAR(255)    NOT NULL,
    -- SHA-256 of "<operation>:<idempotencyKey>"; 64 hex characters
    [key_hash]     CHAR(64)         NOT NULL,
    -- JSON-serialised successful Result value
    [result_json]  NVARCHAR(MAX)    NOT NULL,
    [expires_at]   DATETIMEOFFSET   NOT NULL,
    [_archived_at] DATETIMEOFFSET   NULL,
    [_created_at]  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]  DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]  UNIQUEIDENTIFIER NULL,
    [_updated_by]  UNIQUEIDENTIFIER NULL,
    CONSTRAINT [UQ_idempotency_key] UNIQUE ([key_hash], [operation])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_idempotency_expires')
BEGIN
  CREATE INDEX [idx_idempotency_expires]
    ON [dbo].[idempotency_records] ([expires_at])
    WHERE [_archived_at] IS NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_idempotency_workspace')
BEGIN
  CREATE INDEX [idx_idempotency_workspace]
    ON [dbo].[idempotency_records] ([workspace_id])
    WHERE [workspace_id] IS NOT NULL AND [_archived_at] IS NULL;
END;
GO
