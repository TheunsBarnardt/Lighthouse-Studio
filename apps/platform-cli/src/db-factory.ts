/* eslint-disable no-restricted-imports -- platform-cli is the composition root for the CLI; adapter imports are intentional */
import type { DbTarget } from '@platform/core';
import type { PlatformVersionPort } from '@platform/ports-platform-version';

import { MongoPlatformVersionAdapter } from '@platform/adapter-platform-version-mongo';
import { MssqlPlatformVersionAdapter } from '@platform/adapter-platform-version-mssql';
import { PostgresPlatformVersionAdapter } from '@platform/adapter-platform-version-postgres';
import { MongoMigrationRunner } from '@platform/adapter-persistence-mongo';
import { MssqlMigrationRunner } from '@platform/adapter-persistence-mssql';
import { PostgresMigrationRunner } from '@platform/adapter-persistence-postgres';
/* eslint-enable no-restricted-imports */
import { MongoClient } from 'mongodb';
import * as mssql from 'mssql';
import { Pool } from 'pg';

import type { CliEnv } from './env.js';

export interface DbConnections {
  targets: DbTarget[];
  shutdown(): Promise<void>;
}

export async function buildDbTargets(env: CliEnv): Promise<DbConnections> {
  const targets: DbTarget[] = [];
  const teardowns: Array<() => Promise<void>> = [];

  if (env.postgresUrl) {
    // App pool: read/write only — used for version tracking and health checks.
    const pool = new Pool({ connectionString: env.postgresUrl });
    teardowns.push(() => pool.end());

    // Migrate pool: DDL-privileged user required for schema migrations.
    // Set POSTGRES_MIGRATE_URL to a URL with CREATE/ALTER/DROP privileges.
    const migratePool =
      env.postgresMigrateUrl && env.postgresMigrateUrl !== env.postgresUrl
        ? new Pool({ connectionString: env.postgresMigrateUrl })
        : pool;
    if (migratePool !== pool) {
      teardowns.push(() => migratePool.end());
    }

    const versionPort: PlatformVersionPort = new PostgresPlatformVersionAdapter(pool);
    const migrationPort = new PostgresMigrationRunner(migratePool);

    targets.push({
      id: 'postgres',
      kind: 'postgres',
      versionPort,
      migrationPort,
      async healthCheck() {
        try {
          await pool.query('SELECT 1');
          return true;
        } catch {
          return false;
        }
      },
      latestBackupAt() {
        // real implementation queries pg_stat_archiver or a backup metadata table
        return Promise.resolve(null);
      },
      freeDiskBytes() {
        // pg_database_size gives the database size; free disk requires OS query
        return Promise.resolve(null);
      },
      async longTransactionCount() {
        try {
          const res = await pool.query<{ count: string }>(
            `SELECT COUNT(*) AS count FROM pg_stat_activity
             WHERE state = 'active' AND now() - xact_start > interval '30 seconds'`,
          );
          return parseInt(res.rows[0]?.count ?? '0', 10);
        } catch {
          return 0;
        }
      },
    });
  }

  if (env.mssqlServer && env.mssqlDatabase && env.mssqlUser && env.mssqlPassword) {
    // App pool: read/write only.
    const pool = await mssql.connect({
      server: env.mssqlServer,
      database: env.mssqlDatabase,
      user: env.mssqlUser,
      password: env.mssqlPassword,
      options: { encrypt: true, trustServerCertificate: true },
    });
    teardowns.push(() => pool.close());

    // Migrate pool: DDL-privileged user for schema migrations.
    // Set MSSQL_MIGRATE_USER / MSSQL_MIGRATE_PASSWORD for a user with ALTER/CREATE rights.
    const migrateUser = env.mssqlMigrateUser ?? env.mssqlUser;
    const migratePassword = env.mssqlMigratePassword ?? env.mssqlPassword;
    const migratePool =
      migrateUser !== env.mssqlUser || migratePassword !== env.mssqlPassword
        ? await mssql.connect({
            server: env.mssqlServer,
            database: env.mssqlDatabase,
            user: migrateUser,
            password: migratePassword,
            options: { encrypt: true, trustServerCertificate: true },
          })
        : pool;
    if (migratePool !== pool) {
      teardowns.push(() => migratePool.close());
    }

    const versionPort: PlatformVersionPort = new MssqlPlatformVersionAdapter(pool);
    const migrationPort = new MssqlMigrationRunner(migratePool);

    targets.push({
      id: 'mssql',
      kind: 'mssql',
      versionPort,
      migrationPort,
      async healthCheck() {
        try {
          await pool.request().query('SELECT 1 AS ok');
          return true;
        } catch {
          return false;
        }
      },
      latestBackupAt() { return Promise.resolve(null); },
      freeDiskBytes() { return Promise.resolve(null); },
      longTransactionCount() { return Promise.resolve(0); },
    });
  }

  if (env.mongoUri && env.mongoDatabase) {
    // App client: read/write only.
    const client = new MongoClient(env.mongoUri);
    await client.connect();
    const db = client.db(env.mongoDatabase);
    teardowns.push(() => client.close());

    // Migrate client: DDL-privileged user (createIndex, collMod, etc.).
    // Set MONGO_MIGRATE_URI for a URI with the migrate user credentials.
    const migrateClient =
      env.mongoMigrateUri && env.mongoMigrateUri !== env.mongoUri
        ? new MongoClient(env.mongoMigrateUri)
        : client;
    if (migrateClient !== client) {
      await migrateClient.connect();
      teardowns.push(() => migrateClient.close());
    }
    const migrateDb = migrateClient.db(env.mongoDatabase);

    const versionPort: PlatformVersionPort = new MongoPlatformVersionAdapter(db);
    const migrationPort = new MongoMigrationRunner(migrateDb);

    targets.push({
      id: 'mongo',
      kind: 'mongo',
      versionPort,
      migrationPort,
      async healthCheck() {
        try {
          await db.command({ ping: 1 });
          return true;
        } catch {
          return false;
        }
      },
      latestBackupAt() { return Promise.resolve(null); },
      freeDiskBytes() { return Promise.resolve(null); },
      longTransactionCount() { return Promise.resolve(0); },
    });
  }

  return {
    targets,
    async shutdown() {
      await Promise.allSettled(teardowns.map((fn) => fn()));
    },
  };
}
