import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    const records = db.collection('idempotency_records');

    // Deduplication: (key_hash, operation) must be unique
    await records.createIndex(
      { key_hash: 1, operation: 1 },
      { unique: true, name: 'idx_idempotency_key' },
    );

    // Retention cleanup: find expired records efficiently
    await records.createIndex({ expires_at: 1 }, { name: 'idx_idempotency_expires' });

    // Workspace scope queries
    await records.createIndex(
      { workspace_id: 1 },
      { sparse: true, name: 'idx_idempotency_workspace' },
    );

    // TTL index: MongoDB auto-removes expired documents after 0 seconds past expires_at
    await records.createIndex(
      { expires_at: 1 },
      { expireAfterSeconds: 0, name: 'ttl_idempotency_expires' },
    );

    // JSON schema validator
    await db.command({
      collMod: 'idempotency_records',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['operation', 'key_hash', 'result_json', 'expires_at'],
          properties: {
            key_hash: { bsonType: 'string', minLength: 64, maxLength: 64 },
            operation: { bsonType: 'string', minLength: 1 },
            result_json: { bsonType: 'string', minLength: 1 },
            expires_at: { bsonType: 'date' },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });
  },

  async down(db: Db): Promise<void> {
    await db
      .collection('idempotency_records')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
