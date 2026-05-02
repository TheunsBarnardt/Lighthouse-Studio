import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    // ── workspace_roles ──────────────────────────────────────────────────────
    const roles = db.collection('workspace_roles');
    await roles.createIndex({ workspace_id: 1, name: 1 }, { unique: true, sparse: false });
    await roles.createIndex({ _archived_at: 1 });
    await roles.createIndex({ builtin: 1 });

    // ── role_permissions ─────────────────────────────────────────────────────
    const rolePerms = db.collection('role_permissions');
    await rolePerms.createIndex({ role_id: 1, action: 1, resource_type: 1 }, { unique: true });
    await rolePerms.createIndex({ role_id: 1, _archived_at: 1 });

    // ── workspaces ───────────────────────────────────────────────────────────
    const workspaces = db.collection('workspaces');
    await workspaces.createIndex({ slug: 1 }, { unique: true });
    await workspaces.createIndex({ owner_user_id: 1 });
    await workspaces.createIndex({ _archived_at: 1 });

    // ── workspace_members ────────────────────────────────────────────────────
    const members = db.collection('workspace_members');
    await members.createIndex({ workspace_id: 1, user_id: 1 }, { unique: true });
    await members.createIndex({ workspace_id: 1, status: 1, _archived_at: 1 });
    await members.createIndex({ user_id: 1, _archived_at: 1 });

    // ── workspace_member_roles ───────────────────────────────────────────────
    const memberRoles = db.collection('workspace_member_roles');
    await memberRoles.createIndex({ workspace_member_id: 1, role_id: 1 }, { unique: true });
    await memberRoles.createIndex({ workspace_member_id: 1, _archived_at: 1 });

    // ── installation_role_assignments ────────────────────────────────────────
    const installRoles = db.collection('installation_role_assignments');
    await installRoles.createIndex({ user_id: 1, role: 1 }, { unique: true });
    await installRoles.createIndex({ user_id: 1, _archived_at: 1 });

    // ── workspace_invitations ────────────────────────────────────────────────
    const invitations = db.collection('workspace_invitations');
    await invitations.createIndex({ token_hash: 1 }, { unique: true });
    await invitations.createIndex({ email: 1, _archived_at: 1 });
    await invitations.createIndex({ expires_at: 1, _archived_at: 1 });
    await invitations.createIndex({ workspace_id: 1, _archived_at: 1 });

    // ── workspace_approval_routes ────────────────────────────────────────────
    const approvalRoutes = db.collection('workspace_approval_routes');
    await approvalRoutes.createIndex({ workspace_id: 1, stage: 1 }, { unique: true });
    await approvalRoutes.createIndex({ workspace_id: 1, _archived_at: 1 });

    // ── approvals ────────────────────────────────────────────────────────────
    const approvals = db.collection('approvals');
    await approvals.createIndex(
      { workspace_id: 1, resource_type: 1, resource_id: 1 },
      { sparse: false },
    );
    await approvals.createIndex({ workspace_id: 1, state: 1, _archived_at: 1 });
  },

  async down(db: Db): Promise<void> {
    // Drop collections in reverse dependency order (Mongo has no FK enforcement)
    await db
      .collection('approvals')
      .drop()
      .catch(() => undefined);
    await db
      .collection('workspace_approval_routes')
      .drop()
      .catch(() => undefined);
    await db
      .collection('workspace_invitations')
      .drop()
      .catch(() => undefined);
    await db
      .collection('installation_role_assignments')
      .drop()
      .catch(() => undefined);
    await db
      .collection('workspace_member_roles')
      .drop()
      .catch(() => undefined);
    await db
      .collection('workspace_members')
      .drop()
      .catch(() => undefined);
    await db
      .collection('workspaces')
      .drop()
      .catch(() => undefined);
    await db
      .collection('role_permissions')
      .drop()
      .catch(() => undefined);
    await db
      .collection('workspace_roles')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
