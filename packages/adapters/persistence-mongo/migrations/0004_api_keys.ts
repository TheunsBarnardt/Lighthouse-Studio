import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    const keys = db.collection('api_keys');

    // HMAC hash must be globally unique; used as the definitive de-dup key.
    await keys.createIndex({ key_hash: 1 }, { unique: true, name: 'idx_key_hash' });

    // Active keys per workspace (most common query).
    await keys.createIndex({ workspace_id: 1, revoked_at: 1 }, { name: 'idx_workspace_active' });

    // Lookup by prefix — narrows candidates before HMAC comparison on verify.
    await keys.createIndex({ workspace_id: 1, key_prefix: 1 }, { name: 'idx_workspace_prefix' });

    // JSON schema validator: enforce required fields.
    await db.command({
      collMod: 'api_keys',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['workspace_id', 'name', 'key_prefix', 'key_hash', 'created_by_user_id'],
          properties: {
            key_prefix: { bsonType: 'string', minLength: 8, maxLength: 8 },
            key_hash: { bsonType: 'string', minLength: 64, maxLength: 64 },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });
  },

  async down(db: Db): Promise<void> {
    await db
      .collection('api_keys')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
