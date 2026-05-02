/**
 * Platform migration runner for PostgreSQL.
 *
 * Reads *.sql files from the migrations directory, applies pending migrations in order,
 * and records checksums so tampered migrations are detected.
 *
 * Also implements SchemaMigrationPort for programmatic access.
 *
 * CLI usage (via pnpm db:migrate):
 *   tsx src/migrate.ts apply           — apply all pending migrations
 *   tsx src/migrate.ts status          — show applied / pending
 *   tsx src/migrate.ts create <name>   — scaffold a new migration file
 *   tsx src/migrate.ts down            — roll back the last applied migration
 */

import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type MigrationRecord,
  type SchemaMigrationPort,
} from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';
import { Pool } from 'pg';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACKING_TABLE = '__platform_migrations';

// stdout/stderr helpers for the CLI — process.std* is correct for a CLI script.
const print = (msg: string): void => {
  process.stdout.write(msg + '\n');
};
const printErr = (msg: string): void => {
  process.stderr.write(msg + '\n');
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function checksumSql(sql: string): string {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

async function ensureTrackingTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id          SERIAL       PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      checksum    VARCHAR(64)  NOT NULL,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

// ── SchemaMigrationPort adapter ───────────────────────────────────────────────

export class PostgresMigrationRunner implements SchemaMigrationPort {
  constructor(private readonly pool: Pool) {}

  async listApplied(): Promise<Result<MigrationRecord[], PersistenceError>> {
    try {
      await ensureTrackingTable(this.pool);
      const res = await this.pool.query<{
        id: string;
        name: string;
        checksum: string;
        applied_at: Date;
      }>(`SELECT id::text, name, checksum, applied_at FROM ${TRACKING_TABLE} ORDER BY id`);
      return ok(
        res.rows.map((r) => ({
          id: r.id,
          name: r.name,
          checksum: r.checksum,
          appliedAt: r.applied_at,
        })),
      );
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `listApplied failed: ${String(e)}`, e));
    }
  }

  async apply(migration: {
    id: string;
    name: string;
    up: string;
    down?: string;
  }): Promise<Result<void, PersistenceError>> {
    const checksum = checksumSql(migration.up);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.up);
      await client.query(
        `INSERT INTO ${TRACKING_TABLE} (name, checksum) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [migration.name, checksum],
      );
      await client.query('COMMIT');
      return ok(undefined);
    } catch (e) {
      await client.query('ROLLBACK');
      return err(
        new PersistenceError('UNKNOWN', `Migration "${migration.name}" failed: ${String(e)}`, e),
      );
    } finally {
      client.release();
    }
  }

  async revert(migrationId: string): Promise<Result<void, PersistenceError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM ${TRACKING_TABLE} WHERE id = $1`, [migrationId]);
      await client.query('COMMIT');
      return ok(undefined);
    } catch (e) {
      await client.query('ROLLBACK');
      return err(new PersistenceError('UNKNOWN', `revert failed: ${String(e)}`, e));
    } finally {
      client.release();
    }
  }

  async isApplied(migrationId: string): Promise<Result<boolean, PersistenceError>> {
    try {
      const res = await this.pool.query(`SELECT 1 FROM ${TRACKING_TABLE} WHERE id = $1 LIMIT 1`, [
        migrationId,
      ]);
      return ok((res.rowCount ?? 0) > 0);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `isApplied failed: ${String(e)}`, e));
    }
  }
}

// ── File-based migration runner ───────────────────────────────────────────────

interface MigrationFile {
  name: string; // e.g. "0001_add_workspaces"
  upPath: string;
  downPath: string | null;
}

async function loadMigrationFiles(migrationsDir: string): Promise<MigrationFile[]> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const entries = await fs.readdir(migrationsDir);
  const upFiles = entries
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql') && !f.startsWith('_'))
    .sort();

  return Promise.all(
    upFiles.map((file) => {
      const name = file.replace(/\.sql$/, '');
      const upPath = path.join(migrationsDir, file);
      const downFile = `${name}.down.sql`;
      const downPath = entries.includes(downFile) ? path.join(migrationsDir, downFile) : null;
      return { name, upPath, downPath };
    }),
  );
}

async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  await ensureTrackingTable(pool);

  const files = await loadMigrationFiles(migrationsDir);

  const appliedRes = await pool.query<{ name: string; checksum: string }>(
    `SELECT name, checksum FROM ${TRACKING_TABLE} ORDER BY id`,
  );
  const applied = new Map(appliedRes.rows.map((r) => [r.name, r.checksum]));

  let appliedCount = 0;

  for (const file of files) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const upSql = await fs.readFile(file.upPath, 'utf8');
    const checksum = checksumSql(upSql);

    if (applied.has(file.name)) {
      const recordedChecksum = applied.get(file.name) ?? '';
      if (recordedChecksum !== checksum) {
        throw new Error(
          `Migration "${file.name}" has been tampered with!\n` +
            `Recorded checksum: ${recordedChecksum}\n` +
            `Current checksum:  ${checksum}\n` +
            `Never edit an applied migration. Fix forward with a new migration instead.`,
        );
      }
      continue; // already applied
    }

    print(`Applying migration: ${file.name}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(upSql);
      await client.query(`INSERT INTO ${TRACKING_TABLE} (name, checksum) VALUES ($1, $2)`, [
        file.name,
        checksum,
      ]);
      await client.query('COMMIT');
      appliedCount++;
      print(`  ✓ ${file.name}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`Migration "${file.name}" failed: ${String(e)}`);
    } finally {
      client.release();
    }
  }

  if (appliedCount === 0) {
    print('No pending migrations.');
  } else {
    print(`Applied ${String(appliedCount)} migration(s).`);
  }
}

async function showStatus(pool: Pool, migrationsDir: string): Promise<void> {
  await ensureTrackingTable(pool);

  const files = await loadMigrationFiles(migrationsDir);
  const appliedRes = await pool.query<{ name: string; applied_at: Date }>(
    `SELECT name, applied_at FROM ${TRACKING_TABLE} ORDER BY id`,
  );
  const applied = new Map(appliedRes.rows.map((r) => [r.name, r.applied_at]));

  print('\nMigration status:\n');
  for (const file of files) {
    const date = applied.get(file.name);
    const status = date ? `✓ applied  (${date.toISOString()})` : '○ pending';
    print(`  ${status}  ${file.name}`);
  }
  print('');
}

async function rollbackLast(pool: Pool, migrationsDir: string): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax
  if (process.env['NODE_ENV'] === 'production' && !process.env['ALLOW_PROD_ROLLBACK']) {
    throw new Error(
      'Rollback is disabled in production. Set ALLOW_PROD_ROLLBACK=true to override.',
    );
  }

  await ensureTrackingTable(pool);

  const appliedRes = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM ${TRACKING_TABLE} ORDER BY id DESC LIMIT 1`,
  );
  if (appliedRes.rowCount === 0) {
    print('No applied migrations to roll back.');
    return;
  }

  const last = appliedRes.rows[0];
  if (!last) throw new Error('Unexpected empty rows after rowCount check');

  const files = await loadMigrationFiles(migrationsDir);
  const file = files.find((f) => f.name === last.name);

  if (!file?.downPath) {
    throw new Error(`No down migration found for "${last.name}".`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const downSql = await fs.readFile(file.downPath, 'utf8');
  print(`Rolling back: ${last.name}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(downSql);
    await client.query(`DELETE FROM ${TRACKING_TABLE} WHERE id = $1`, [last.id]);
    await client.query('COMMIT');
    print(`  ✓ rolled back ${last.name}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw new Error(`Rollback of "${last.name}" failed: ${String(e)}`);
  } finally {
    client.release();
  }
}

async function createMigration(migrationsDir: string, name: string): Promise<void> {
  const files = await loadMigrationFiles(migrationsDir).catch(() => [] as MigrationFile[]);
  const idx = String(files.length).padStart(4, '0');
  const tag = `${idx}_${name.replace(/\s+/g, '_').toLowerCase()}`;

  const upPath = path.join(migrationsDir, `${tag}.sql`);
  const downPath = path.join(migrationsDir, `${tag}.down.sql`);

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.writeFile(upPath, `-- Migration ${tag}\n-- Description: ${name}\n\n`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.writeFile(downPath, `-- Down migration for ${tag}\n\n`);

  print(`Created:\n  ${upPath}\n  ${downPath}`);
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

const isMain = process.argv[1] === url.fileURLToPath(import.meta.url);

if (isMain) {
  const [, , command, ...args] = process.argv;
  const migrationsDir = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    '../../migrations',
  );

  // eslint-disable-next-line no-restricted-syntax
  const dbUrl = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];
  if (!dbUrl) {
    printErr('POSTGRES_DIRECT_URL or POSTGRES_URL must be set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  const run = async (): Promise<void> => {
    switch (command) {
      case 'apply':
        await runMigrations(pool, migrationsDir);
        break;
      case 'status':
        await showStatus(pool, migrationsDir);
        break;
      case 'down':
        await rollbackLast(pool, migrationsDir);
        break;
      case 'create': {
        const migName = args.join(' ') || 'migration';
        await createMigration(migrationsDir, migName);
        break;
      }
      default:
        printErr(`Unknown command: ${String(command)}`);
        printErr('Usage: migrate.ts apply|status|down|create <name>');
        process.exit(1);
    }
  };

  run()
    .then(() => pool.end())
    .catch((e: unknown) => {
      printErr(e instanceof Error ? e.message : String(e));
      void pool.end().finally(() => process.exit(1));
    });
}

export { runMigrations, checksumSql };
