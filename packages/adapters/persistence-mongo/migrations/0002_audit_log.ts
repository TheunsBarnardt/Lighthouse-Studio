import type { Db } from 'mongodb';

import { randomBytes } from 'node:crypto';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    // ── audit_chain_state ────────────────────────────────────────────────────
    // One document per workspace. Updated atomically with findOneAndUpdate.
    const chainState = db.collection('audit_chain_state');

    await chainState.createIndex({ workspace_id: 1 }, { unique: true });

    // Seed the installation chain sentinel (workspace_id = null sentinel)
    await chainState.updateOne(
      { workspace_id: null },
      {
        $setOnInsert: {
          workspace_id: null,
          last_sequence: 0,
          last_hash: '0'.repeat(64),
          initialized_at: new Date(),
          initialization_seed: randomBytes(32).toString('hex'),
        },
      },
      { upsert: true },
    );

    // ── audit_log ────────────────────────────────────────────────────────────
    // Append-only collection. Application user has insert-only access (enforced
    // at the MongoDB user/role level; see runbook: grant-installation-roles.md).
    const auditLog = db.collection('audit_log');

    // Compound index: primary query pattern (workspace + time)
    await auditLog.createIndex(
      { workspace_id: 1, occurred_at: -1 },
      { name: 'idx_workspace_time' },
    );

    // Compound index: actor queries
    await auditLog.createIndex(
      { workspace_id: 1, actor_id: 1, occurred_at: -1 },
      { name: 'idx_workspace_actor_time', sparse: true },
    );

    // Compound index: resource queries
    await auditLog.createIndex(
      { workspace_id: 1, resource_type: 1, resource_id: 1, occurred_at: -1 },
      { name: 'idx_workspace_resource_time' },
    );

    // Compound index: event type queries
    await auditLog.createIndex(
      { workspace_id: 1, event_type: 1, occurred_at: -1 },
      { name: 'idx_workspace_event_type_time' },
    );

    // Correlation ID lookup
    await auditLog.createIndex({ correlation_id: 1 }, { name: 'idx_correlation_id' });

    // Per-workspace monotonic sequence (used for hash chain ordering)
    await auditLog.createIndex(
      { workspace_id: 1, sequence: 1 },
      { unique: true, name: 'idx_workspace_sequence' },
    );

    // JSON schema validator: enforce required fields and no-update invariant
    // (the no-update/no-delete invariant is enforced at the application user level,
    //  not via schema validator, because validators run on writes, not on the
    //  absence of update permissions.)
    await db.command({
      collMod: 'audit_log',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'sequence',
            'event_type',
            'occurred_at',
            'actor_kind',
            'resource_type',
            'resource_id',
            'action',
            'outcome',
            'correlation_id',
            'prev_hash',
            'hash',
          ],
          properties: {
            actor_kind: { bsonType: 'string', enum: ['user', 'service_account', 'system'] },
            outcome: { bsonType: 'string', enum: ['success', 'failure', 'denied'] },
            prev_hash: { bsonType: 'string', minLength: 64, maxLength: 64 },
            hash: { bsonType: 'string', minLength: 64, maxLength: 64 },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });
  },

  async down(db: Db): Promise<void> {
    await db
      .collection('audit_log')
      .drop()
      .catch(() => undefined);
    await db
      .collection('audit_chain_state')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
