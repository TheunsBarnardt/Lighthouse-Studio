-- Migration 0001: workspace_rbac
-- Creates all workspace, membership, role, permission, invitation, approval, and
-- approval-routing tables. Also creates the effective-permissions materialized view
-- and the triggers that keep it current.

-- ── workspace_roles ────────────────────────────────────────────────────────────
-- Built-in roles have workspace_id = NULL and builtin = TRUE.
-- Custom roles have workspace_id set and builtin = FALSE.

CREATE TABLE IF NOT EXISTS workspace_roles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version        INTEGER      NOT NULL DEFAULT 1,
  workspace_id    UUID,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  builtin         BOOLEAN      NOT NULL DEFAULT FALSE,
  parent_role_id  UUID         REFERENCES workspace_roles(id),
  _archived_at    TIMESTAMPTZ,
  _created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by     UUID,
  _updated_by     UUID,
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workspace_roles_workspace_id
  ON workspace_roles (workspace_id)
  WHERE _archived_at IS NULL;

-- ── role_permissions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version        INTEGER      NOT NULL DEFAULT 1,
  role_id         UUID         NOT NULL REFERENCES workspace_roles(id) ON DELETE CASCADE,
  action          VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(100) NOT NULL,
  _archived_at    TIMESTAMPTZ,
  _created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by     UUID,
  _updated_by     UUID,
  UNIQUE (role_id, action, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
  ON role_permissions (role_id)
  WHERE _archived_at IS NULL;

-- ── workspaces ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version        INTEGER      NOT NULL DEFAULT 1,
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  description     TEXT,
  owner_user_id   UUID         NOT NULL,
  settings        JSONB        NOT NULL DEFAULT '{}',
  archived_reason VARCHAR(500),
  _archived_at    TIMESTAMPTZ,
  _created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by     UUID,
  _updated_by     UUID
);

CREATE INDEX IF NOT EXISTS idx_workspaces_archived_at ON workspaces (_archived_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id ON workspaces (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces (slug);

-- ── workspace_members ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_members (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version          INTEGER      NOT NULL DEFAULT 1,
  workspace_id      UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id           UUID         NOT NULL,
  status            VARCHAR(20)  NOT NULL CHECK (status IN ('pending', 'active', 'archived')),
  invited_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  accepted_at       TIMESTAMPTZ,
  invited_by_user_id UUID,
  _archived_at      TIMESTAMPTZ,
  _created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by       UUID,
  _updated_by       UUID,
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
  ON workspace_members (workspace_id)
  WHERE _archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON workspace_members (user_id)
  WHERE _archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_status
  ON workspace_members (status)
  WHERE _archived_at IS NULL;

-- ── workspace_member_roles ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_member_roles (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version              INTEGER      NOT NULL DEFAULT 1,
  workspace_member_id   UUID         NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  role_id               UUID         NOT NULL REFERENCES workspace_roles(id),
  granted_by_user_id    UUID,
  _archived_at          TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by           UUID,
  _updated_by           UUID,
  UNIQUE (workspace_member_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_member_id
  ON workspace_member_roles (workspace_member_id)
  WHERE _archived_at IS NULL;

-- ── installation_role_assignments ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS installation_role_assignments (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version            INTEGER      NOT NULL DEFAULT 1,
  user_id             UUID         NOT NULL,
  role                VARCHAR(50)  NOT NULL CHECK (role IN ('installation_owner', 'installation_admin', 'installation_auditor')),
  granted_by_user_id  UUID,
  _archived_at        TIMESTAMPTZ,
  _created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by         UUID,
  _updated_by         UUID,
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_installation_role_assignments_user_id
  ON installation_role_assignments (user_id)
  WHERE _archived_at IS NULL;

-- ── workspace_invitations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version              INTEGER      NOT NULL DEFAULT 1,
  workspace_id          UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email                 VARCHAR(255) NOT NULL,
  invited_by_user_id    UUID         NOT NULL,
  initial_roles         JSONB        NOT NULL DEFAULT '[]',
  token_hash            VARCHAR(256) NOT NULL UNIQUE,
  expires_at            TIMESTAMPTZ  NOT NULL,
  accepted_at           TIMESTAMPTZ,
  accepted_by_user_id   UUID,
  _archived_at          TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by           UUID,
  _updated_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email
  ON workspace_invitations (email)
  WHERE _archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires_at
  ON workspace_invitations (expires_at)
  WHERE _archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id
  ON workspace_invitations (workspace_id)
  WHERE _archived_at IS NULL;

-- ── workspace_approval_routes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspace_approval_routes (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version        INTEGER      NOT NULL DEFAULT 1,
  workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stage           VARCHAR(100) NOT NULL,
  config          JSONB        NOT NULL,
  _archived_at    TIMESTAMPTZ,
  _created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by     UUID,
  _updated_by     UUID,
  UNIQUE (workspace_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_workspace_approval_routes_workspace_id
  ON workspace_approval_routes (workspace_id)
  WHERE _archived_at IS NULL;

-- ── approvals ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approvals (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  _version              INTEGER      NOT NULL DEFAULT 1,
  workspace_id          UUID         NOT NULL REFERENCES workspaces(id),
  resource_type         VARCHAR(100) NOT NULL,
  resource_id           UUID         NOT NULL,
  stage                 VARCHAR(100) NOT NULL,
  route_snapshot        JSONB        NOT NULL,
  state                 VARCHAR(20)  NOT NULL CHECK (state IN ('pending', 'approved', 'rejected', 'cancelled')),
  resolved_at           TIMESTAMPTZ,
  resolved_by_user_id   UUID,
  resolution            JSONB,
  _archived_at          TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  _created_by           UUID,
  _updated_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_approvals_workspace_resource
  ON approvals (workspace_id, resource_type, resource_id)
  WHERE _archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approvals_state
  ON approvals (state)
  WHERE _archived_at IS NULL;

-- ── effective_permissions materialized view ────────────────────────────────────
-- Pre-computes the full set of permissions per (user_id, workspace_id) by
-- walking the role hierarchy up to 5 levels deep.
-- Refreshed by the trigger functions below on any role mutation.

CREATE MATERIALIZED VIEW IF NOT EXISTS effective_permissions AS
WITH RECURSIVE role_hierarchy AS (
  -- Base: direct role assignments for active members
  SELECT
    wm.user_id,
    wm.workspace_id,
    wmr.role_id,
    0 AS depth
  FROM workspace_members wm
  JOIN workspace_member_roles wmr ON wmr.workspace_member_id = wm.id
    AND wmr._archived_at IS NULL
  WHERE wm.status = 'active'
    AND wm._archived_at IS NULL

  UNION ALL

  -- Recursive: parent roles (up to 5 levels)
  SELECT
    rh.user_id,
    rh.workspace_id,
    wr.parent_role_id AS role_id,
    rh.depth + 1
  FROM role_hierarchy rh
  JOIN workspace_roles wr ON wr.id = rh.role_id
    AND wr._archived_at IS NULL
    AND wr.parent_role_id IS NOT NULL
  WHERE rh.depth < 5
)
SELECT DISTINCT
  rh.user_id,
  rh.workspace_id,
  rp.action,
  rp.resource_type
FROM role_hierarchy rh
JOIN role_permissions rp ON rp.role_id = rh.role_id
  AND rp._archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_effective_permissions_pk
  ON effective_permissions (user_id, workspace_id, action, resource_type);
CREATE INDEX IF NOT EXISTS idx_effective_permissions_user_workspace
  ON effective_permissions (user_id, workspace_id);

-- ── Trigger: refresh effective_permissions on role mutations ──────────────────

CREATE OR REPLACE FUNCTION refresh_effective_permissions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY effective_permissions;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_refresh_ep_after_member_roles
AFTER INSERT OR UPDATE OR DELETE ON workspace_member_roles
FOR EACH STATEMENT EXECUTE FUNCTION refresh_effective_permissions();

CREATE OR REPLACE TRIGGER trg_refresh_ep_after_role_perms
AFTER INSERT OR UPDATE OR DELETE ON role_permissions
FOR EACH STATEMENT EXECUTE FUNCTION refresh_effective_permissions();

CREATE OR REPLACE TRIGGER trg_refresh_ep_after_members
AFTER INSERT OR UPDATE OR DELETE ON workspace_members
FOR EACH STATEMENT EXECUTE FUNCTION refresh_effective_permissions();
