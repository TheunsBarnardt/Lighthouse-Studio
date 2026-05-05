import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    await db.createCollection('platform_versions');

    const versions = db.collection('platform_versions');

    await versions.createIndex({ applied_at: -1 }, { name: 'idx_platform_versions_applied_at' });

    await db.command({
      collMod: 'platform_versions',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['release_version', 'applied_at'],
          properties: {
            release_version: { bsonType: 'string', minLength: 1, maxLength: 64 },
            applied_at: { bsonType: 'date' },
            applied_by: { bsonType: ['string', 'null'] },
            schema_migration_high_water: { bsonType: ['string', 'null'], maxLength: 128 },
            notes: { bsonType: ['string', 'null'] },
          },
        },
      },
      validationLevel: 'moderate',
    });
  },

  async down(db: Db): Promise<void> {
    await db
      .collection('platform_versions')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
