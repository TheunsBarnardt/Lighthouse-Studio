-- Down: 0001_workspace_rbac
-- Removes all workspace/RBAC tables and the materialized view in reverse dependency order.

DROP TRIGGER IF EXISTS trg_refresh_ep_after_members ON workspace_members;
DROP TRIGGER IF EXISTS trg_refresh_ep_after_role_perms ON role_permissions;
DROP TRIGGER IF EXISTS trg_refresh_ep_after_member_roles ON workspace_member_roles;
DROP FUNCTION IF EXISTS refresh_effective_permissions();

DROP MATERIALIZED VIEW IF EXISTS effective_permissions;

DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS workspace_approval_routes;
DROP TABLE IF EXISTS workspace_invitations;
DROP TABLE IF EXISTS installation_role_assignments;
DROP TABLE IF EXISTS workspace_member_roles;
DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS workspaces;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS workspace_roles;
