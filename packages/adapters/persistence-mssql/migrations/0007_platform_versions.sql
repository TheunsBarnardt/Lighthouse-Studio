-- Migration 0007: platform_versions (MSSQL)
-- Append-only audit log of platform release-version upgrades.
-- Distinct from __platform_migrations (which tracks SCHEMA migrations).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'platform_versions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[platform_versions] (
    [id]                          UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [release_version]             NVARCHAR(64)      NOT NULL,
    [applied_at]                  DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [applied_by]                  UNIQUEIDENTIFIER  NULL,
    [schema_migration_high_water] NVARCHAR(128)     NULL,
    [notes]                       NVARCHAR(MAX)     NULL
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_platform_versions_applied_at')
BEGIN
  CREATE INDEX [idx_platform_versions_applied_at]
    ON [dbo].[platform_versions] ([applied_at] DESC);
END;
GO
