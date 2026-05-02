-- MSSQL identity schema for the platform's built-in user directory and session management.
-- Run once (idempotent) before the application starts.

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = 'dbo' AND t.name = 'identity_users'
)
CREATE TABLE [dbo].[identity_users] (
  [id]             UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  [primary_email]  NVARCHAR(255)    NOT NULL,
  [email_verified] BIT              NOT NULL DEFAULT 0,
  [display_name]   NVARCHAR(255)    NULL,
  [status]         NVARCHAR(50)     NOT NULL DEFAULT 'pending_verification'
                     CONSTRAINT [identity_users_status_ck]
                     CHECK ([status] IN ('active', 'pending_verification', 'archived')),
  [archived_at]    DATETIME2(7)     NULL,
  [mfa_enabled]    BIT              NOT NULL DEFAULT 0,
  [preferences]    NVARCHAR(MAX)    NOT NULL DEFAULT '{}',
  [created_at]     DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
  [updated_at]     DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'identity_users_email_uq')
  CREATE UNIQUE INDEX [identity_users_email_uq]
    ON [dbo].[identity_users] ([primary_email])
    WHERE [status] != 'archived';

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = 'dbo' AND t.name = 'identity_identities'
)
CREATE TABLE [dbo].[identity_identities] (
  [id]             UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  [user_id]        UNIQUEIDENTIFIER NOT NULL
                     REFERENCES [dbo].[identity_users]([id]) ON DELETE CASCADE,
  [provider_id]    NVARCHAR(255)    NOT NULL,
  [subject]        NVARCHAR(255)    NOT NULL,
  [email]          NVARCHAR(255)    NULL,
  [email_verified] BIT              NOT NULL DEFAULT 0,
  [is_primary]     BIT              NOT NULL DEFAULT 0,
  [linked_at]      DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
  [last_used_at]   DATETIME2(7)     NULL,
  CONSTRAINT [identity_identities_provider_subject_uq] UNIQUE ([provider_id], [subject])
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'identity_identities_user_id_idx')
  CREATE INDEX [identity_identities_user_id_idx]
    ON [dbo].[identity_identities] ([user_id]);

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = 'dbo' AND t.name = 'identity_credentials'
)
CREATE TABLE [dbo].[identity_credentials] (
  [user_id]              UNIQUEIDENTIFIER NOT NULL PRIMARY KEY
                           REFERENCES [dbo].[identity_users]([id]) ON DELETE CASCADE,
  [password_hash]        NVARCHAR(MAX)    NULL,
  [password_version]     INT              NULL,
  [password_algorithm]   NVARCHAR(50)     NULL,
  [mfa_ciphertext]       NVARCHAR(MAX)    NULL,
  [mfa_key_version]      NVARCHAR(50)     NULL,
  [recovery_codes]       NVARCHAR(MAX)    NOT NULL DEFAULT '[]',
  [failed_login_count]   INT              NOT NULL DEFAULT 0,
  [last_failed_login_at] DATETIME2(7)     NULL,
  [lockout_until]        DATETIME2(7)     NULL,
  [updated_at]           DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = 'dbo' AND t.name = 'identity_sessions'
)
CREATE TABLE [dbo].[identity_sessions] (
  [id]                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  [user_id]           UNIQUEIDENTIFIER NOT NULL
                        REFERENCES [dbo].[identity_users]([id]) ON DELETE CASCADE,
  [token_hash]        NVARCHAR(255)    NOT NULL,
  [identity_provider] NVARCHAR(100)    NOT NULL DEFAULT 'builtin',
  [workspace_id]      UNIQUEIDENTIFIER NULL,
  [created_at]        DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
  [last_seen_at]      DATETIME2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
  [expires_at]        DATETIME2(7)     NOT NULL,
  [ip_address]        NVARCHAR(50)     NULL,
  [user_agent]        NVARCHAR(500)    NULL,
  [metadata]          NVARCHAR(MAX)    NOT NULL DEFAULT '{}'
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'identity_sessions_token_hash_uq')
  CREATE UNIQUE INDEX [identity_sessions_token_hash_uq]
    ON [dbo].[identity_sessions] ([token_hash]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'identity_sessions_user_id_idx')
  CREATE INDEX [identity_sessions_user_id_idx]
    ON [dbo].[identity_sessions] ([user_id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'identity_sessions_expires_at_idx')
  CREATE INDEX [identity_sessions_expires_at_idx]
    ON [dbo].[identity_sessions] ([expires_at]);
