/**
 * Platform migration runner for MSSQL.
 *
 * Implements SchemaMigrationPort for programmatic access.
 * Also provides a file-based CLI runner for applying *.sql migration files.
 *
 * CLI:
 *   tsx src/migrate.ts apply           — apply all pending migrations
 *   tsx src/migrate.ts status          — show applied / pending
 *   tsx src/migrate.ts create <name>   — scaffold new migration
 *   tsx src/migrate.ts down            — roll back last migration
 */

import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type MigrationRecord,
  type SchemaMigrationPort,
} from '@platform/ports-persistence';
import * as mssql from 'mssql';
import { err, ok } from 'neverthrow';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';

const TRACKING_TABLE = '[dbo].[__platform_migrations]';

const print = (msg: string): void => {
  process.stdout.write(msg + '\n');
};
const printErr = (msg: string): void => {
  process.stderr.write(msg + '\n');
};

export function checksumSql(sql: string): string {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

async function ensureTrackingTable(pool: mssql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = 'dbo' AND t.name = '__platform_migrations'
    )
    CREATE TABLE ${TRACKING_TABLE} (
      [id]         NVARCHAR(255)  NOT NULL PRIMARY KEY,
      [name]       NVARCHAR(255)  NOT NULL UNIQUE,
      [checksum]   NVARCHAR(64)   NOT NULL,
      [applied_at] DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `);
}

// ── SchemaMigrationPort adapter ───────────────────────────────────────────────

export class MssqlMigrationRunner implements SchemaMigrationPort {
  constructor(
    private readonly pool: mssql.ConnectionPool,
    private readonly migrationsDir?: string,
  ) {}

  async listApplied(): Promise<Result<MigrationRecord[], PersistenceError>> {
    try {
      await ensureTrackingTable(this.pool);
      const res = await this.pool.request().query(
        `SELECT [id], [name], [applied_at], [checksum]
         FROM ${TRACKING_TABLE}
         ORDER BY [applied_at] ASC`,
      );
      const records = (
        res.recordset as {
          id: string;
          name: string;
          applied_at: Date;
          checksum: string;
        }[]
      ).map((r) => ({
        id: r.id,
        name: r.name,
        appliedAt: r.applied_at,
        checksum: r.checksum,
      }));
      return ok(records);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list migrations: ${String(e)}`, e));
    }
  }

  async apply(migration: {
    id: string;
    name: string;
    up: string;
    down?: string;
  }): Promise<Result<void, PersistenceError>> {
    const checksum = checksumSql(migration.up);
    const transaction = new mssql.Transaction(this.pool);
    try {
      await ensureTrackingTable(this.pool);
      await transaction.begin();
      await transaction.request().query(migration.up);
      const req = transaction.request();
      req.input('id', migration.id);
      req.input('name', migration.name);
      req.input('checksum', checksum);
      await req.query(
        `INSERT INTO ${TRACKING_TABLE} ([id], [name], [checksum])
         SELECT @id, @name, @checksum
         WHERE NOT EXISTS (SELECT 1 FROM ${TRACKING_TABLE} WHERE [id] = @id)`,
      );
      await transaction.commit();
      return ok(undefined);
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        // ignore rollback error
      }
      return err(
        new PersistenceError('UNKNOWN', `Migration "${migration.name}" failed: ${String(e)}`, e),
      );
    }
  }

  async revert(migrationId: string): Promise<Result<void, PersistenceError>> {
    const transaction = new mssql.Transaction(this.pool);
    try {
      await transaction.begin();
      const req = transaction.request();
      req.input('id', migrationId);
      await req.query(`DELETE FROM ${TRACKING_TABLE} WHERE [id] = @id`);
      await transaction.commit();
      return ok(undefined);
    } catch (e) {
      try {
        await transaction.rollback();
      } catch {
        // ignore rollback error
      }
      return err(new PersistenceError('UNKNOWN', `revert failed: ${String(e)}`, e));
    }
  }

  async isApplied(migrationId: string): Promise<Result<boolean, PersistenceError>> {
    try {
      await ensureTrackingTable(this.pool);
      const req = this.pool.request();
      req.input('id', migrationId);
      const res = await req.query(`SELECT COUNT(1) AS cnt FROM ${TRACKING_TABLE} WHERE [id] = @id`);
      const cnt = (res.recordset[0] as { cnt: number }).cnt;
      return ok(cnt > 0);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `isApplied failed: ${String(e)}`, e));
    }
  }

  // ── File-based helpers (used by CLI) ──────────────────────────────────────

  async applyPending(): Promise<Result<MigrationRecord[], PersistenceError>> {
    const migrationsDir = this.migrationsDir;
    if (!migrationsDir) {
      return err(new PersistenceError('UNKNOWN', 'migrationsDir not configured'));
    }
    try {
      await ensureTrackingTable(this.pool);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const files = (await fs.readdir(migrationsDir))
        .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
        .sort();

      const appliedRes = await this.listApplied();
      if (appliedRes.isErr()) return err(appliedRes.error);
      const appliedSet = new Set(appliedRes.value.map((r) => r.name));

      const applied: MigrationRecord[] = [];

      for (const file of files) {
        if (appliedSet.has(file)) continue;

        const filePath = path.join(migrationsDir, file);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const sql = await fs.readFile(filePath, 'utf8');
        const checksum = checksumSql(sql);
        const id = checksum.slice(0, 16);

        const applyRes = await this.apply({ id, name: file, up: sql });
        if (applyRes.isErr()) return err(applyRes.error);

        applied.push({ id, name: file, appliedAt: new Date(), checksum });
        print(`  Applied: ${file}`);
      }

      return ok(applied);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Migration failed: ${String(e)}`, e));
    }
  }

  async rollbackLast(): Promise<Result<void, PersistenceError>> {
    try {
      const appliedRes = await this.listApplied();
      if (appliedRes.isErr()) return err(appliedRes.error);
      const applied = appliedRes.value;
      if (applied.length === 0) {
        return err(new PersistenceError('UNKNOWN', 'No migrations to roll back'));
      }

      const last = applied[applied.length - 1];
      if (!last) return err(new PersistenceError('UNKNOWN', 'No migrations to roll back'));

      const migrationsDir = this.migrationsDir;
      if (!migrationsDir) {
        return err(new PersistenceError('UNKNOWN', 'migrationsDir not configured'));
      }

      const downFile = path.join(migrationsDir, last.name.replace(/\.sql$/, '.down.sql'));
      let downSql: string;
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        downSql = await fs.readFile(downFile, 'utf8');
      } catch {
        return err(
          new PersistenceError('UNKNOWN', `No rollback file found for migration: ${last.name}`),
        );
      }

      await this.pool.request().query(downSql);
      const revertRes = await this.revert(last.id);
      if (revertRes.isErr()) return revertRes;
      print(`  Rolled back: ${last.name}`);
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Rollback failed: ${String(e)}`, e));
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  // eslint-disable-next-line no-restricted-syntax
  const server = process.env['MSSQL_SERVER'] ?? 'localhost';
  // eslint-disable-next-line no-restricted-syntax
  const port = parseInt(process.env['MSSQL_PORT'] ?? '1433', 10);
  // eslint-disable-next-line no-restricted-syntax
  const database = process.env['MSSQL_DATABASE'] ?? 'platform';
  // eslint-disable-next-line no-restricted-syntax
  const user = process.env['MSSQL_USER'] ?? 'sa';
  // eslint-disable-next-line no-restricted-syntax
  const password = process.env['MSSQL_PASSWORD'] ?? '';

  const pool = new mssql.ConnectionPool({
    server,
    port,
    database,
    user,
    password,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
  });

  const __filename = url.fileURLToPath(import.meta.url);
  const migrationsDir = path.join(path.dirname(__filename), '..', 'migrations');

  try {
    await pool.connect();
    const runner = new MssqlMigrationRunner(pool, migrationsDir);

    switch (command) {
      case 'apply': {
        print('Applying migrations…');
        const r = await runner.applyPending();
        if (r.isErr()) {
          printErr(r.error.message);
          process.exitCode = 1;
          break;
        }
        print(
          r.value.length === 0
            ? 'No pending migrations.'
            : `Applied ${String(r.value.length)} migration(s).`,
        );
        break;
      }
      case 'status': {
        const r = await runner.listApplied();
        if (r.isErr()) {
          printErr(r.error.message);
          process.exitCode = 1;
          break;
        }
        if (r.value.length === 0) {
          print('No migrations applied.');
          break;
        }
        r.value.forEach((m) => {
          print(`  [x] ${m.name}  (${m.appliedAt.toISOString()})`);
        });
        break;
      }
      case 'down': {
        const r = await runner.rollbackLast();
        if (r.isErr()) {
          printErr(r.error.message);
          process.exitCode = 1;
        }
        break;
      }
      case 'create': {
        const name = args[0];
        if (!name) {
          printErr('Usage: migrate.ts create <migration-name>');
          process.exitCode = 1;
          break;
        }
        const ts = new Date()
          .toISOString()
          .replace(/[-T:.Z]/g, '')
          .slice(0, 14);
        const fileName = `${ts}_${name}.sql`;
        await fs.mkdir(migrationsDir, { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fs.writeFile(path.join(migrationsDir, fileName), `-- Migration: ${name}\n`);
        print(`Created: ${fileName}`);
        break;
      }
      default:
        printErr(`Unknown command: ${command ?? '(none)'}. Use: apply | status | down | create`);
        process.exitCode = 1;
    }
  } finally {
    await pool.close();
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => {
    process.stderr.write(String(e) + '\n');
    process.exitCode = 1;
  });
}
