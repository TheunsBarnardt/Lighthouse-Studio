-- Migration 0001: workspace_rbac (MSSQL)
-- Creates workspace, membership, role, permission, invitation, approval, and
-- approval-routing tables. MSSQL equivalent of the Postgres 0001 migration.
-- Uses IF NOT EXISTS guards so the migration is idempotent.

-- ── workspace_roles ────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'workspace_roles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[workspace_roles] (
    [id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]        INT              NOT NULL DEFAULT 1,
    [workspace_id]    UNIQUEIDENTIFIER NULL,
    [name]            NVARCHAR(100)    NOT NULL,
    [description]     NVARCHAR(MAX)    NULL,
    [builtin]         BIT              NOT NULL DEFAULT 0,
    [parent_role_id]  UNIQUEIDENTIFIER NULL REFERENCES [dbo].[workspace_roles]([id]),
    [_archived_at]    DATETIMEOFFSET   NULL,
    [_created_at]     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]     UNIQUEIDENTIFIER NULL,
    [_updated_by]     UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_workspace_roles_workspace_name UNIQUE ([workspace_id], [name])
  );
  CREATE INDEX IX_workspace_roles_workspace_id ON [dbo].[workspace_roles] ([workspace_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── role_permissions ───────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[role_permissions] (
    [id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]       INT              NOT NULL DEFAULT 1,
    [role_id]        UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspace_roles]([id]) ON DELETE CASCADE,
    [action]         NVARCHAR(100)    NOT NULL,
    [resource_type]  NVARCHAR(100)    NOT NULL,
    [_archived_at]   DATETIMEOFFSET   NULL,
    [_created_at]    DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]    DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]    UNIQUEIDENTIFIER NULL,
    [_updated_by]    UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_role_permissions_role_action_resource UNIQUE ([role_id], [action], [resource_type])
  );
  CREATE INDEX IX_role_permissions_role_id ON [dbo].[role_permissions] ([role_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── workspaces ─────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'workspaces' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[workspaces] (
    [id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]         INT              NOT NULL DEFAULT 1,
    [name]             NVARCHAR(255)    NOT NULL,
    [slug]             NVARCHAR(100)    NOT NULL,
    [description]      NVARCHAR(MAX)    NULL,
    [owner_user_id]    UNIQUEIDENTIFIER NOT NULL,
    [settings]         NVARCHAR(MAX)    NOT NULL DEFAULT '{}' CHECK (ISJSON([settings]) = 1),
    [archived_reason]  NVARCHAR(500)    NULL,
    [_archived_at]     DATETIMEOFFSET   NULL,
    [_created_at]      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]      DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]      UNIQUEIDENTIFIER NULL,
    [_updated_by]      UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_workspaces_slug UNIQUE ([slug])
  );
  CREATE INDEX IX_workspaces_archived_at      ON [dbo].[workspaces] ([_archived_at]);
  CREATE INDEX IX_workspaces_owner_user_id    ON [dbo].[workspaces] ([owner_user_id]);
  CREATE INDEX IX_workspaces_slug             ON [dbo].[workspaces] ([slug]);
END;
GO

-- ── workspace_members ──────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'workspace_members' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[workspace_members] (
    [id]                   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]             INT              NOT NULL DEFAULT 1,
    [workspace_id]         UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspaces]([id]) ON DELETE CASCADE,
    [user_id]              UNIQUEIDENTIFIER NOT NULL,
    [status]               NVARCHAR(20)     NOT NULL CHECK ([status] IN ('pending', 'active', 'archived')),
    [invited_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [accepted_at]          DATETIMEOFFSET   NULL,
    [invited_by_user_id]   UNIQUEIDENTIFIER NULL,
    [_archived_at]         DATETIMEOFFSET   NULL,
    [_created_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]          UNIQUEIDENTIFIER NULL,
    [_updated_by]          UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_workspace_members_workspace_user UNIQUE ([workspace_id], [user_id])
  );
  CREATE INDEX IX_workspace_members_workspace_id ON [dbo].[workspace_members] ([workspace_id])
    WHERE [_archived_at] IS NULL;
  CREATE INDEX IX_workspace_members_user_id ON [dbo].[workspace_members] ([user_id])
    WHERE [_archived_at] IS NULL;
  CREATE INDEX IX_workspace_members_status ON [dbo].[workspace_members] ([status])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── workspace_member_roles ─────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'workspace_member_roles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[workspace_member_roles] (
    [id]                     UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]               INT              NOT NULL DEFAULT 1,
    [workspace_member_id]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspace_members]([id]) ON DELETE CASCADE,
    [role_id]                UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspace_roles]([id]),
    [granted_by_user_id]     UNIQUEIDENTIFIER NULL,
    [_archived_at]           DATETIMEOFFSET   NULL,
    [_created_at]            DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]            DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]            UNIQUEIDENTIFIER NULL,
    [_updated_by]            UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_workspace_member_roles_member_role UNIQUE ([workspace_member_id], [role_id])
  );
  CREATE INDEX IX_workspace_member_roles_member_id ON [dbo].[workspace_member_roles] ([workspace_member_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── installation_role_assignments ─────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'installation_role_assignments' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[installation_role_assignments] (
    [id]                   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]             INT              NOT NULL DEFAULT 1,
    [user_id]              UNIQUEIDENTIFIER NOT NULL,
    [role]                 NVARCHAR(50)     NOT NULL CHECK ([role] IN ('installation_owner', 'installation_admin', 'installation_auditor')),
    [granted_by_user_id]   UNIQUEIDENTIFIER NULL,
    [_archived_at]         DATETIMEOFFSET   NULL,
    [_created_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]          DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]          UNIQUEIDENTIFIER NULL,
    [_updated_by]          UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_installation_role_assignments_user_role UNIQUE ([user_id], [role])
  );
  CREATE INDEX IX_installation_role_assignments_user_id ON [dbo].[installation_role_assignments] ([user_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── workspace_invitations ──────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'workspace_invitations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[workspace_invitations] (
    [id]                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]              INT              NOT NULL DEFAULT 1,
    [workspace_id]          UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspaces]([id]) ON DELETE CASCADE,
    [email]                 NVARCHAR(255)    NOT NULL,
    [invited_by_user_id]    UNIQUEIDENTIFIER NOT NULL,
    [initial_roles]         NVARCHAR(MAX)    NOT NULL DEFAULT '[]' CHECK (ISJSON([initial_roles]) = 1),
    [token_hash]            NVARCHAR(256)    NOT NULL,
    [expires_at]            DATETIMEOFFSET   NOT NULL,
    [accepted_at]           DATETIMEOFFSET   NULL,
    [accepted_by_user_id]   UNIQUEIDENTIFIER NULL,
    [_archived_at]          DATETIMEOFFSET   NULL,
    [_created_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]           UNIQUEIDENTIFIER NULL,
    [_updated_by]           UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_workspace_invitations_token_hash UNIQUE ([token_hash])
  );
  CREATE INDEX IX_workspace_invitations_email ON [dbo].[workspace_invitations] ([email])
    WHERE [_archived_at] IS NULL;
  CREATE INDEX IX_workspace_invitations_expires_at ON [dbo].[workspace_invitations] ([expires_at])
    WHERE [_archived_at] IS NULL;
  CREATE INDEX IX_workspace_invitations_workspace_id ON [dbo].[workspace_invitations] ([workspace_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── workspace_approval_routes ──────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'workspace_approval_routes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[workspace_approval_routes] (
    [id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]        INT              NOT NULL DEFAULT 1,
    [workspace_id]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspaces]([id]) ON DELETE CASCADE,
    [stage]           NVARCHAR(100)    NOT NULL,
    [config]          NVARCHAR(MAX)    NOT NULL CHECK (ISJSON([config]) = 1),
    [_archived_at]    DATETIMEOFFSET   NULL,
    [_created_at]     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]     DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]     UNIQUEIDENTIFIER NULL,
    [_updated_by]     UNIQUEIDENTIFIER NULL,
    CONSTRAINT UQ_workspace_approval_routes_workspace_stage UNIQUE ([workspace_id], [stage])
  );
  CREATE INDEX IX_workspace_approval_routes_workspace_id ON [dbo].[workspace_approval_routes] ([workspace_id])
    WHERE [_archived_at] IS NULL;
END;
GO

-- ── approvals ─────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'approvals' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE [dbo].[approvals] (
    [id]                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,
    [_version]              INT              NOT NULL DEFAULT 1,
    [workspace_id]          UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[workspaces]([id]),
    [resource_type]         NVARCHAR(100)    NOT NULL,
    [resource_id]           UNIQUEIDENTIFIER NOT NULL,
    [stage]                 NVARCHAR(100)    NOT NULL,
    [route_snapshot]        NVARCHAR(MAX)    NOT NULL CHECK (ISJSON([route_snapshot]) = 1),
    [state]                 NVARCHAR(20)     NOT NULL CHECK ([state] IN ('pending', 'approved', 'rejected', 'cancelled')),
    [resolved_at]           DATETIMEOFFSET   NULL,
    [resolved_by_user_id]   UNIQUEIDENTIFIER NULL,
    [resolution]            NVARCHAR(MAX)    NULL CHECK ([resolution] IS NULL OR ISJSON([resolution]) = 1),
    [_archived_at]          DATETIMEOFFSET   NULL,
    [_created_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_updated_at]           DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [_created_by]           UNIQUEIDENTIFIER NULL,
    [_updated_by]           UNIQUEIDENTIFIER NULL
  );
  CREATE INDEX IX_approvals_workspace_resource ON [dbo].[approvals] ([workspace_id], [resource_type], [resource_id])
    WHERE [_archived_at] IS NULL;
  CREATE INDEX IX_approvals_state ON [dbo].[approvals] ([state])
    WHERE [_archived_at] IS NULL;
END;
GO
