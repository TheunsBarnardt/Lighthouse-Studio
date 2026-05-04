-- Migration 0004: api_keys (MSSQL)
-- Platform-managed API keys for server-to-server access to the customer data API.
-- Keys are stored as HMAC-SHA-256 hashes; the plaintext is returned once on creation.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'api_keys' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[api_keys] (
    [id]                  UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    [_version]            INT              NOT NULL DEFAULT 1,
    [workspace_id]        UNIQUEIDENTIFIER NOT NULL,
    [name]                NVARCHAR(255)    NOT NULL,
    -- First 8 characters of the key (after the pkey_ prefix); used for lookup.
    [key_prefix]          CHAR(8)          NOT NULL,
    -- HMAC-SHA-256 of the full raw key; 64 hex characters.
    [key_hash]            CHAR(64)         NOT NULL,
    -- Optional permission overrides; null means "inherit creator's permissions".
    [permissions]         NVARCHAR(MAX)    NULL,
    [expires_at]          DATETIMEOFFSET   NULL,
    [last_used_at]        DATETIMEOFFSET   NULL,
    [revoked_at]          DATETIMEOFFSET   NULL,
    [created_by_user_id]  UNIQUEIDENTIFIER NOT NULL,
    [_archived_at]        DATETIMEOFFSET   NULL,
    [_created_at]         DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]         DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT [UQ_api_keys_hash] UNIQUE ([key_hash])
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_api_keys_workspace')
BEGIN
  CREATE INDEX [idx_api_keys_workspace]
    ON [dbo].[api_keys] ([workspace_id])
    WHERE [revoked_at] IS NULL;
END;
GO

-- Lookup by prefix (step 1 of verify: narrow candidates before HMAC comparison).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_api_keys_prefix')
BEGIN
  CREATE INDEX [idx_api_keys_prefix]
    ON [dbo].[api_keys] ([workspace_id], [key_prefix])
    WHERE [revoked_at] IS NULL;
END;
GO
