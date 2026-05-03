import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    // ── customer_schemas ──────────────────────────────────────────────────────
    // Platform metadata for each customer-defined schema.
    // Actual customer collections are prefixed cust_<workspace_slug>__.
    const schemas = db.collection('customer_schemas');

    // workspace_id + slug uniqueness
    await schemas.createIndex(
      { workspace_id: 1, slug: 1 },
      { unique: true, name: 'idx_workspace_slug' },
    );

    // Active schemas per workspace (most common query pattern)
    await schemas.createIndex(
      { workspace_id: 1, _archived_at: 1 },
      { name: 'idx_workspace_active' },
    );

    // Driver filter
    await schemas.createIndex(
      { workspace_id: 1, database_driver: 1 },
      { name: 'idx_workspace_driver' },
    );

    // JSON schema validator: enforce required fields
    await db.command({
      collMod: 'customer_schemas',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'workspace_id',
            'name',
            'slug',
            'database_driver',
            'schema_definition',
            'current_version',
          ],
          properties: {
            database_driver: { bsonType: 'string', enum: ['postgres', 'mssql', 'mongo'] },
            current_version: { bsonType: 'int', minimum: 1 },
            schema_definition: { bsonType: 'object' },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });

    // ── customer_schema_versions ──────────────────────────────────────────────
    // Immutable history of schema snapshots at each version.
    const versions = db.collection('customer_schema_versions');

    await versions.createIndex(
      { schema_id: 1, version: 1 },
      { unique: true, name: 'idx_schema_version' },
    );

    await versions.createIndex({ schema_id: 1, applied_at: -1 }, { name: 'idx_schema_applied_at' });

    // ── customer_schema_migrations ────────────────────────────────────────────
    // Tracks individual migration runs.
    const migrations = db.collection('customer_schema_migrations');

    await migrations.createIndex(
      { schema_id: 1, _created_at: -1 },
      { name: 'idx_schema_created_at' },
    );

    // Active migration check (only one running at a time per schema)
    await migrations.createIndex(
      { schema_id: 1, status: 1 },
      { name: 'idx_schema_status', sparse: true },
    );
  },

  async down(db: Db): Promise<void> {
    await db
      .collection('customer_schema_migrations')
      .drop()
      .catch(() => undefined);
    await db
      .collection('customer_schema_versions')
      .drop()
      .catch(() => undefined);
    await db
      .collection('customer_schemas')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
