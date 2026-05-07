import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    // ── ai_artifacts ──────────────────────────────────────────────────────────

    const artifacts = db.collection('ai_artifacts');

    await artifacts.createIndex(
      { workspace_id: 1, stage: 1, status: 1 },
      { name: 'idx_ai_artifacts_workspace_stage_status' },
    );

    await artifacts.createIndex(
      { workspace_id: 1, _updated_at: -1 },
      { name: 'idx_ai_artifacts_workspace_updated' },
    );

    await artifacts.createIndex(
      { workspace_id: 1, approval_id: 1 },
      { sparse: true, name: 'idx_ai_artifacts_approval' },
    );

    await artifacts.createIndex(
      { parent_artifact_ids: 1 },
      { name: 'idx_ai_artifacts_parent_ids' },
    );

    await db.command({
      collMod: 'ai_artifacts',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['workspace_id', 'stage', 'type', 'status', 'content'],
          properties: {
            workspace_id: { bsonType: 'string', minLength: 1 },
            stage: { bsonType: 'string' },
            type: { bsonType: 'string' },
            status: {
              enum: ['draft', 'awaiting_approval', 'approved', 'rejected', 'archived'],
            },
            current_version: { bsonType: 'int', minimum: 1 },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'warn',
    });

    // ── ai_usage_records ──────────────────────────────────────────────────────

    const usage = db.collection('ai_usage_records');

    await usage.createIndex(
      { workspace_id: 1, _created_at: -1 },
      { name: 'idx_ai_usage_workspace_created' },
    );

    await usage.createIndex(
      { workspace_id: 1, stage: 1, _created_at: -1 },
      { name: 'idx_ai_usage_workspace_stage_created' },
    );

    // TTL: keep usage records for 90 days
    await usage.createIndex(
      { _created_at: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 90, name: 'ttl_ai_usage_cleanup' },
    );

    // ── ai_response_cache ─────────────────────────────────────────────────────

    const cache = db.collection('ai_response_cache');

    await cache.createIndex({ cache_key: 1 }, { unique: true, name: 'idx_ai_cache_key' });

    await cache.createIndex({ expires_at: 1 }, { name: 'idx_ai_cache_expires' });

    // TTL: MongoDB auto-removes expired cache entries
    await cache.createIndex(
      { expires_at: 1 },
      { expireAfterSeconds: 0, name: 'ttl_ai_cache_cleanup' },
    );
  },

  async down(db: Db): Promise<void> {
    for (const name of ['ai_response_cache', 'ai_usage_records', 'ai_artifacts']) {
      await db
        .collection(name)
        .drop()
        .catch(() => undefined);
    }
  },
};

export default migration;
