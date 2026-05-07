-- Migration 0002: audit_log (MSSQL)
-- Creates audit_log and audit_chain_state tables for tamper-evident,
-- append-only audit logging with SHA-256 hash chaining per workspace.

-- ── audit_chain_state ──────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_chain_state' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[audit_chain_state] (
    [workspace_id]        UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    [last_sequence]       BIGINT           NOT NULL DEFAULT 0,
    [last_hash]           CHAR(64)         NOT NULL,
    [initialized_at]      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [initialization_seed] CHAR(64)         NOT NULL
  );
END;
GO

-- Installation chain sentinel row (zero UUID)
IF NOT EXISTS (
  SELECT 1 FROM [dbo].[audit_chain_state]
  WHERE [workspace_id] = '00000000-0000-0000-0000-000000000000'
)
BEGIN
  INSERT INTO [dbo].[audit_chain_state] (
    [workspace_id], [last_sequence], [last_hash], [initialization_seed]
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    0,
    '0000000000000000000000000000000000000000000000000000000000000000',
    LOWER(CONVERT(CHAR(64), HASHBYTES('SHA2_256', CAST(NEWID() AS NVARCHAR(36))), 2))
  );
END;
GO

-- ── audit_log ──────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_log' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[audit_log] (
    [id]                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [sequence]                BIGINT           NOT NULL,
    [workspace_id]            UNIQUEIDENTIFIER NOT NULL,
    [event_type]              NVARCHAR(255)    NOT NULL,
    [occurred_at]             DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [actor_kind]              NVARCHAR(20)     NOT NULL
      CONSTRAINT CK_audit_log_actor_kind CHECK ([actor_kind] IN ('user', 'service_account', 'system')),
    [actor_id]                UNIQUEIDENTIFIER NULL,
    [actor_identity_provider] NVARCHAR(100)    NULL,
    [actor_email_snapshot]    NVARCHAR(255)    NULL,
    [resource_type]           NVARCHAR(100)    NOT NULL,
    [resource_id]             NVARCHAR(255)    NOT NULL,
    [action]                  NVARCHAR(100)    NOT NULL,
    [outcome]                 NVARCHAR(10)     NOT NULL
      CONSTRAINT CK_audit_log_outcome CHECK ([outcome] IN ('success', 'failure', 'denied')),
    [reason]                  NVARCHAR(MAX)    NULL,
    [metadata]                NVARCHAR(MAX)    NOT NULL DEFAULT '{}',
    [ip_address]              NVARCHAR(45)     NULL,
    [user_agent]              NVARCHAR(500)    NULL,
    [correlation_id]          NVARCHAR(255)    NOT NULL,
    [prev_hash]               CHAR(64)         NOT NULL,
    [hash]                    CHAR(64)         NOT NULL,
    CONSTRAINT PK_audit_log PRIMARY KEY ([workspace_id], [sequence])
  );
END;
GO

-- ── Indexes ────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_log_workspace_time' AND object_id = OBJECT_ID('dbo.audit_log'))
  CREATE INDEX IX_audit_log_workspace_time ON [dbo].[audit_log] ([workspace_id], [occurred_at] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_log_workspace_actor_time' AND object_id = OBJECT_ID('dbo.audit_log'))
  CREATE INDEX IX_audit_log_workspace_actor_time ON [dbo].[audit_log] ([workspace_id], [actor_id], [occurred_at] DESC)
  WHERE [actor_id] IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_log_workspace_resource_time' AND object_id = OBJECT_ID('dbo.audit_log'))
  CREATE INDEX IX_audit_log_workspace_resource_time ON [dbo].[audit_log] ([workspace_id], [resource_type], [resource_id], [occurred_at] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_log_workspace_event_type_time' AND object_id = OBJECT_ID('dbo.audit_log'))
  CREATE INDEX IX_audit_log_workspace_event_type_time ON [dbo].[audit_log] ([workspace_id], [event_type], [occurred_at] DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_log_correlation_id' AND object_id = OBJECT_ID('dbo.audit_log'))
  CREATE INDEX IX_audit_log_correlation_id ON [dbo].[audit_log] ([correlation_id]);
GO

-- ── App-user permissions ───────────────────────────────────────────────────────
-- Grant INSERT (but not UPDATE/DELETE) on audit_log to app_user if it exists.

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'app_user' AND type = 'S')
BEGIN
  GRANT SELECT, INSERT ON [dbo].[audit_log] TO [app_user];
  DENY UPDATE, DELETE ON [dbo].[audit_log] TO [app_user];
  GRANT SELECT, UPDATE ON [dbo].[audit_chain_state] TO [app_user];
  DENY INSERT, DELETE ON [dbo].[audit_chain_state] TO [app_user];
END;
GO

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'audit_retention_user' AND type = 'S')
BEGIN
  GRANT SELECT, DELETE ON [dbo].[audit_log] TO [audit_retention_user];
END;
GO
