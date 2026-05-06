-- Migration 0006: storage (MSSQL)
-- Five tables backing the Storage Browser & File Management module (Objective 15).

-- ── storage_buckets ────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'storage_buckets' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[storage_buckets] (
    [id]                  UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]            INT               NOT NULL DEFAULT 1,
    [workspace_id]        UNIQUEIDENTIFIER  NOT NULL,
    [name]                NVARCHAR(255)     NOT NULL,
    [slug]                NVARCHAR(128)     NOT NULL,
    [description]         NVARCHAR(MAX)     NULL,
    [default_role_grants] NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [default_pii_flag]    BIT               NOT NULL DEFAULT 0,
    [storage_class]       NVARCHAR(32)      NOT NULL DEFAULT 'standard'
                            CONSTRAINT [CK_storage_buckets_class] CHECK ([storage_class] IN ('standard', 'infrequent', 'archive')),
    [metadata]            NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [_archived_at]        DATETIMEOFFSET    NULL,
    [_created_at]         DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]         DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]         UNIQUEIDENTIFIER  NULL,
    CONSTRAINT [UQ_storage_bucket_workspace_slug] UNIQUE ([workspace_id], [slug])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_storage_buckets_workspace')
BEGIN
  CREATE INDEX [idx_storage_buckets_workspace]
    ON [dbo].[storage_buckets] ([workspace_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── file_records ───────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'file_records' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[file_records] (
    [id]                UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]          INT               NOT NULL DEFAULT 1,
    [workspace_id]      UNIQUEIDENTIFIER  NOT NULL,
    [bucket_id]         UNIQUEIDENTIFIER  NOT NULL,
    [storage_key]       NVARCHAR(MAX)     NOT NULL,
    [filename]          NVARCHAR(512)     NOT NULL,
    [folder_path]       NVARCHAR(900)     NOT NULL DEFAULT '',
    [size_bytes]        BIGINT            NOT NULL CONSTRAINT [CK_file_records_size] CHECK ([size_bytes] >= 0),
    [content_type]      NVARCHAR(255)     NULL,
    [etag]              NVARCHAR(128)     NULL,
    [uploader_user_id]  UNIQUEIDENTIFIER  NULL,
    -- JSON array of strings stored as NVARCHAR(MAX)
    [tags]              NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
    [custom_metadata]   NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [pii_flag]          BIT               NOT NULL DEFAULT 0,
    [pii_categories]    NVARCHAR(MAX)     NOT NULL DEFAULT '[]',
    [status]            NVARCHAR(32)      NOT NULL DEFAULT 'available'
                          CONSTRAINT [CK_file_records_status] CHECK ([status] IN ('uploading', 'available', 'archiving', 'deleted')),
    [_archived_at]      DATETIMEOFFSET    NULL,
    [_created_at]       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]       DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [FK_file_records_bucket] FOREIGN KEY ([bucket_id]) REFERENCES [dbo].[storage_buckets] ([id])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_file_records_bucket_folder')
BEGIN
  CREATE INDEX [idx_file_records_bucket_folder]
    ON [dbo].[file_records] ([workspace_id], [bucket_id], [folder_path])
    WHERE [_archived_at] IS NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_file_records_workspace_filename')
BEGIN
  CREATE INDEX [idx_file_records_workspace_filename]
    ON [dbo].[file_records] ([workspace_id], [filename])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── file_acls ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'file_acls' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[file_acls] (
    [id]          UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]    INT               NOT NULL DEFAULT 1,
    [file_id]     UNIQUEIDENTIFIER  NOT NULL,
    [acl]         NVARCHAR(MAX)     NOT NULL DEFAULT '{}',
    [_created_at] DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at] DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_file_acl_file] UNIQUE ([file_id]),
    CONSTRAINT [FK_file_acls_file] FOREIGN KEY ([file_id]) REFERENCES [dbo].[file_records] ([id])
  );
END;
GO

-- ── signed_urls ────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'signed_urls' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[signed_urls] (
    [id]                  UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [workspace_id]        UNIQUEIDENTIFIER  NOT NULL,
    [file_id]             UNIQUEIDENTIFIER  NOT NULL,
    [token_hash]          CHAR(64)          NOT NULL,
    [created_by_user_id]  UNIQUEIDENTIFIER  NULL,
    [expires_at]          DATETIMEOFFSET    NOT NULL,
    [revoked_at]          DATETIMEOFFSET    NULL,
    [download_limit]      INT               NULL CONSTRAINT [CK_signed_urls_limit] CHECK ([download_limit] > 0),
    [download_count]      INT               NOT NULL DEFAULT 0 CONSTRAINT [CK_signed_urls_count] CHECK ([download_count] >= 0),
    [description]         NVARCHAR(MAX)     NULL,
    [direct_mode]         BIT               NOT NULL DEFAULT 0,
    [_created_at]         DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_signed_url_token] UNIQUE ([token_hash]),
    CONSTRAINT [FK_signed_urls_file] FOREIGN KEY ([file_id]) REFERENCES [dbo].[file_records] ([id])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_signed_urls_expires')
BEGIN
  CREATE INDEX [idx_signed_urls_expires]
    ON [dbo].[signed_urls] ([expires_at]);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_signed_urls_file')
BEGIN
  CREATE INDEX [idx_signed_urls_file]
    ON [dbo].[signed_urls] ([file_id]);
END;
GO

-- ── storage_quotas ─────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'storage_quotas' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[storage_quotas] (
    [id]                    UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]              INT               NOT NULL DEFAULT 1,
    [workspace_id]          UNIQUEIDENTIFIER  NOT NULL,
    [quota_bytes]           BIGINT            NOT NULL DEFAULT 10737418240,
    [used_bytes]            BIGINT            NOT NULL DEFAULT 0 CONSTRAINT [CK_storage_quotas_used] CHECK ([used_bytes] >= 0),
    [warning_sent_80]       BIT               NOT NULL DEFAULT 0,
    [warning_sent_95]       BIT               NOT NULL DEFAULT 0,
    [last_reconciled_at]    DATETIMEOFFSET    NULL,
    [_created_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET    NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_storage_quota_workspace] UNIQUE ([workspace_id])
  );
END;
GO
